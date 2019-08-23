'use strict';

const http = require('http');
const UrlLib = require('url-lib');

let mockedResponses = new Map();

http.createServer(async function(request, response) {
  try {
    const { method, url } = request;

    if (method === 'POST' && url === '/_register') {
      const {
        path,
        response: responseBody,
        status_code = 200,
        timeout = 0,
        repeat = 1
      } = await readBody({ request });

      if (!path) {
        throw new Error('No path given');
      }

      const canonicalPath = canonicalize(path);
      mockedResponses.set(canonicalPath, {
        path: canonicalPath,
        responseBody,
        status_code,
        timeout,
        repeat
      });

      log('Registered response',
        JSON.stringify(mockedResponses.get(canonicalPath), null, 2));

      response.writeHead(200);
      response.end();
    } else if (method === 'POST' && url === '/_reset') {
      mockedResponses = new Map();

      log('Reset all responses');

      response.writeHead(200);
      response.end();
    } else {
      const canonicalPath = canonicalize(url);

      if (!mockedResponses.has(canonicalPath)) {
        throw new Error(`No response registered for path ${canonicalPath}`);
      }

      const mockedResponse = mockedResponses.get(canonicalPath);
      const {
        responseBody,
        status_code,
        timeout
      } = mockedResponse;

      if (timeout) {
        await new Promise(resolve => setTimeout(resolve, timeout));
      }

      mockedResponse.repeat--;
      if (mockedResponse.repeat === 0) {
        mockedResponses.delete(canonicalPath);
      }

      response.writeHead(status_code, { 'Content-Type': 'application/json' });

      if (responseBody) {
        const stringBody = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
        log(`Sending mocked response for path: ${canonicalPath}:`, stringBody);
        response.write(stringBody);
      } else {
        log(`Sending empty response for path: ${canonicalPath}`);
      }

      response.end();
    }
  } catch (err) {
    log('Unexpected error', err);
    response.writeHead(500);
    response.write(`Error: ${err.message}`);
    response.end();
  }
}).listen(8080);

async function readBody({ request }) {
  return await new Promise((resolve, reject) => {
    let body = [];
    request
      .on('data', (chunk) => {
        body.push(chunk);
      })
      .on('end', () => {
        resolve(JSON.parse(Buffer.concat(body).toString()));
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function canonicalize(path) {
  const { pathname, query: queryString } = UrlLib.parseUrl(path);

  if (!queryString) {
    return path;
  }

  const queryObject = UrlLib.parseQuery(queryString);
  const newQueryObject = {};
  for (const key of Object.keys(queryObject).sort()) {
    newQueryObject[key] = queryObject[key];
  }

  return `${pathname}?${UrlLib.formatQuery(newQueryObject)}`;
}

function log(...args) {
  console.log(...[`[${new Date().toISOString()}]`, ...args]);
}

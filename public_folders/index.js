// Modules
const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');

// Config
const PORT = process.env.PORT || 8443;
const FOLDERS = process.env.FOLDERS || 'media:/media';
const DIRECTORY_LISTING = false;
const REQUEST_LOGGING = false;

// Parse folder mappings
const folderMappings = FOLDERS.split(',').reduce((mappings, folder) => {
  const [handle, directory] = folder.split(':');
  mappings[handle] = directory;
  return mappings;
}, {});

// Error handler
const handleError = (res, statusCode, message) => {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
  res.end(`Error ${statusCode}: ${message}`);
  if (REQUEST_LOGGING) {
    console.log(`Returned Code ${statusCode}: ${message}`);
  }
};

// File serving handler
const serveFile = (res, filePath) => {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      handleError(res, err.code === 'ENOENT' ? 404 : 500, 'File not found');
      return;
    }

    if (stats.isDirectory()) {
      if (!DIRECTORY_LISTING) {
        handleError(res, 403, 'Directory listing is disabled');
        return;
      }

      fs.readdir(filePath, (err, files) => {
        if (err) {
          handleError(res, 500, 'Directory read error');
          return;
        }

        const fileList = files.map(file => `<a href="${path.join(filePath, file)}">${file}</a>`).join('<br>');
        const content = `<html><body><h1>Directory Listing:</h1>${fileList}</body></html>`;
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Length': Buffer.byteLength(content)
        });
        res.end(content);
      });
    } else {
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', () => handleError(res, 500, 'File read error'));
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size
      });
      fileStream.pipe(res);
    }
  });
};

// Request handler
const handleRequest = (req, res) => {
  if (REQUEST_LOGGING) {
    console.log(`Request: ${req.method} ${req.url}`);
  }

  const parsedUrl = url.parse(req.url, true);
  const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment);

  if (pathSegments.length < 2) {
    handleError(res, 400, 'Invalid URL format');
    return;
  }

  const handle = pathSegments[0];
  const directory = folderMappings[handle];

  if (!directory) {
    handleError(res, 404, 'Invalid handle');
    return;
  }

  const filePath = path.join(directory, ...pathSegments.slice(1));
  serveFile(res, filePath);
};

// Create HTTP server
const server = http.createServer(handleRequest);

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
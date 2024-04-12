// Modules
const fs = require('fs');
const http = require('http');
const path = require('path');
const mime = require('mime-types'); // Ensure to install mime-types package using npm

// Config
const PORT = process.env.PORT || 8080;

// Load Config:
const config = require("./data/options.json");

const LISTDIRS = config.directory_listing;
const LOGGING = config.request_logging;
const FOLDERS = config.folders;

console.log(`Setting Request Logging: ${LOGGING ? "on" : "off"}.`);
console.log(`Setting Directory Listing: ${LISTDIRS ? "on" : "off"}.`);

// Directory Mappings
const directories = { directories: {} };

for (let str of FOLDERS) {
    let [full_url, full_path] = str.split(":");

    if (!full_url.match(/([a-zA-Z\-_0-9\/\.]+)/)) {
        console.error(`Invalid url path ${full_url}`);
        continue;
    }

    if (!full_path.match(/([a-zA-Z\-_0-9\/\.]+)/)) {
        console.error(`Invalid directory path ${full_path}`);
        continue;
    }

    let parts = full_url.split("/");
    let base_url = parts.shift();
    let directory = directories.directories[base_url] || (directories.directories[base_url] = { directories: {} });

    for (let part of parts) {
        directory = directory.directories[part] || (directory.directories[part] = { directories: {} });
    }

    directory.path = full_path;
    console.log(`Serving ${full_path} at :${PORT}/${full_url}`);
}

// Error Handler
const error = (req, res, code, message) => {
    res.writeHead(code, { 'Content-Type': 'text/plain' });
    res.end(`Error ${code}: ${message}`);

    if (LOGGING) {
        console.log(`Returned Code ${code} for ${req.url}`);
        console.log("Reason:", message);
    }
};

// Handler:
const handler = (req, res) => {
    if (LOGGING) console.log("Requesting:", req.url);

    let found;
    let location = [];
    let directory = directories;
    let parts = req.url.split("/").filter(part => part.length > 0);

    while (parts.length > 0) {
        let part = parts.shift();
        if (directory.directories[part]) {
            location.push(part);
            directory = directory.directories[part];
            if (directory.path) found = { location: [...location], parts: [...parts], directory };
            continue;
        }
        break;
    }

    if (found) {
        directory = found.directory;
        location = found.location;
        parts = found.parts;
    }

    if (!directory || !directory.path) return error(req, res, 404, "Resource not found");

    let userpath = path.join(...location, ...parts);
    let filepath = path.join(directory.path, ...parts);

    if (LOGGING) console.log("Resolved Location:", filepath);

    fs.stat(filepath, (err, stats) => {
        if (err) {
            return error(req, res, err.code === 'ENOENT' ? 404 : 500, "File not accessible");
        }

        if (stats.isDirectory()) {
            if (!LISTDIRS) return error(req, res, 403, "Directory listing is disabled.");

            fs.readdir(filepath, (err, files) => {
                if (err) return error(req, res, 500, "Directory read error");

                const content = `Directory: ${userpath}<br>` + files.map(file => `<a href="/${path.join(userpath, file)}">${file}</a>`).join('<br>');
                res.writeHead(200, {
                    'Content-Type': 'text/html',
                    'Content-Length': Buffer.byteLength(content)
                });
                res.end(content);

                if (LOGGING) console.log("Returned directory listing.");
            });
        } else {
            const filename = path.basename(filepath);

            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': stats.size,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-File-Size': stats.size
            });

            const readStream = fs.createReadStream(filepath);

            readStream.on('error', error => {
                res.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                res.end(`Server error: ${error}`);
                if (LOGGING) console.log("Error reading file:", error);
            });

            readStream.pipe(res);

            readStream.on('close', () => {
                res.end();
                if (LOGGING) console.log("Returned file successfully.");
            });
        }
    });
};

// Create HTTP server.
console.log(`Starting HTTP server on port ${PORT}`);
http.createServer(handler).listen(PORT, () => {
    console.log(`HTTP server started on port ${PORT}.`);
});

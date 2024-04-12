ARG BUILD_FROM
FROM $BUILD_FROM

# Install node js and npm
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /

# Copy package.json
COPY package.json ./

# Install npm dependencies
RUN npm install

# Copy node file and run script
COPY index.js ./
COPY run.sh ./

# Make the run script executable
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

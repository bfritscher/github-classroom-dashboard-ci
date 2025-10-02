FROM eclipse-temurin:25-jdk-noble

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        software-properties-common gnupg-agent git curl && \
    add-apt-repository -y ppa:deadsnakes/ppa && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        nodejs \
        python3.13 && \
    update-alternatives --install /usr/bin/python python /usr/bin/python3.13 1 && \
    curl https://bootstrap.pypa.io/get-pip.py | python && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g mocha chai mochawesome && \
    pip install -U pytest pytest-html pytest-json-report
RUN mkdir -p /app
WORKDIR /app
COPY package.json /app/
RUN npm install && npm cache clean --force
COPY /src /app/src
COPY /public /app/public
CMD [ "npm", "start" ]

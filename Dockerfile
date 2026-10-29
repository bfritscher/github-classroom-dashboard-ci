FROM eclipse-temurin:27-jdk-resolute

ENV PATH="/opt/venv/bin:${PATH}"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        software-properties-common gnupg-agent git curl && \
    add-apt-repository -y ppa:deadsnakes/ppa && \
    curl -fsSL https://deb.nodesource.com/setup_26.x | bash - && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        nodejs \
        python3.14 \
        python3.14-venv && \
    python3.14 -m venv /opt/venv && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g mocha chai mochawesome && \
    python -m pip install --no-cache-dir -U pytest pytest-html pytest-json-report
RUN mkdir -p /app
WORKDIR /app
COPY package.json /app/
RUN npm install && npm cache clean --force
COPY /src /app/src
COPY /public /app/public
CMD [ "npm", "start" ]

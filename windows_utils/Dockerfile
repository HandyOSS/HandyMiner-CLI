FROM node:11

WORKDIR /usr/hsd

RUN apt-get update
RUN apt-get install libunbound-dev -y

RUN git clone https://github.com/handshake-org/hsd.git /usr/hsd

RUN npm install --production

RUN npm install github:HandshakeAlliance/hstratum#feature_pow_ng

COPY ./run.sh run.sh

COPY ./stop.sh stop.sh

RUN sed -i -e 's/\r$//' run.sh

RUN chmod 0775 run.sh

RUN sed -i -e 's/\r$//' stop.sh

RUN chmod 0775 stop.sh

WORKDIR /usr/hsd

EXPOSE 12937 12938 13937 13938 13939 15937 15938 15939 3008

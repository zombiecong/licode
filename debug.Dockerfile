FROM daocloud.io/webrtc_cloud/bjy-licode-env-debug

MAINTAINER chencong@baijiayun.com

RUN apt-get install -y gdb

COPY . /opt/licode/ 

WORKDIR /opt/licode/scripts

RUN ./installErizo.sh -emf

ENV LICODE_NODE_PATH=/opt/licode/erizoAPI/build/Debug/addon
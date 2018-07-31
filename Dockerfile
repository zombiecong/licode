FROM daocloud.io/webrtc_cloud/bjy-licode-env

MAINTAINER chencong@baijiayun.com


COPY . /opt/licode/ 

WORKDIR /opt/licode/scripts

RUN ./installErizo.sh -remf

ENV LICODE_NODE_PATH=/opt/licode/erizoAPI/build/Release/addon

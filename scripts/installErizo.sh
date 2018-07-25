#!/usr/bin/env bash

set -e

SCRIPT=`pwd`/$0
FILENAME=`basename $SCRIPT`
PATHNAME=`dirname $SCRIPT`
ROOT=$PATHNAME/..
BUILD_DIR=$ROOT/build
CURRENT_DIR=`pwd`
LIB_DIR=$BUILD_DIR/libdeps
PREFIX_DIR=$LIB_DIR/build/
NVM_CHECK="$PATHNAME"/checkNvm.sh
FAST_MAKE=''
DR='debug'

NUM_CORES=1;
if [ "$(uname)" == "Darwin" ]; then
  NUM_CORES=$(sysctl -n hw.ncpu);
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
  NUM_CORES=$(grep -c ^processor /proc/cpuinfo);
fi

export ERIZO_HOME=$ROOT/erizo

usage()
{
cat << EOF
usage: $0 options

Compile erizo libraries:
- Erizo is the C++ core
- Erizo API is the Javascript layer of Erizo (require Erizo to be compiled)
- Erizo Controller implements the signaling, communication with clients and room management
- Spine is a node.js based Erizo client

OPTIONS:
   -h      Show this message
   -e      Compile Erizo
   -a      Compile Erizo API
   -m      Use my own node instead of nvm
   -r      Release , default Debug
   -c      Install Erizo node modules
   -d      Delete Erizo object files
   -f      Use 4 threads to build
   -s      Install Spine
   -t      Run Tests
EOF
}


pause() {
  read -p "$*"
}

check_result() {
  if [ "$1" -ne 0 ]
  then
    exit $1
  fi
}


release(){
  DR='release'
}

install_erizo(){
  echo 'Installing erizo...'
  cd $ROOT/erizo
  ./generateProject.sh $DR
  ./buildProject.sh $FAST_MAKE
  if [ "$DELETE_OBJECT_FILES" == "true" ]; then
    ./cleanObjectFiles.sh
  fi
  check_result $?
  cd $CURRENT_DIR
}

install_erizo_api(){
  echo 'Installing erizoAPI...'
  cd $ROOT/erizoAPI
  . $NVM_CHECK
  nvm use
  npm install nan@2.3.2
  $FAST_BUILD ./build.sh
  check_result $?
  cd $CURRENT_DIR
}

install_erizo_api_mynode(){
  echo 'Installing erizoAPI with local node...'
  cd $ROOT/erizoAPI
  export GYP_FILE=$DR.gyp
  node-gyp2 rebuild
  check_result $?
  cd $CURRENT_DIR
}


install_erizo_controller(){
  echo 'Installing erizoController...'
  cp $PATHNAME/rtp_media_config_default.js $ROOT/rtp_media_config.js
  cd $ROOT/erizo_controller
  ./installErizo_controller.sh
  check_result $?
  cd $CURRENT_DIR
}

install_spine(){
  echo 'Installing erizo_native_client...'
  cd $ROOT/spine
  ./installSpine.sh
  check_result $?
  cd $CURRENT_DIR
}

execute_tests(){
  echo 'Testing erizo...'
  cd $ROOT/erizo
  ./runTests.sh
  check_result $?
  cd $CURRENT_DIR
}

if [ "$#" -eq 0 ]
then
  install_erizo
  install_erizo_api
  install_erizo_controller
  install_spine
else
  while getopts “rheacstfdm” OPTION
  do
    case $OPTION in
      h)
        usage
        exit 1
        ;;
      r)
        release
        ;;
      e)
        install_erizo
        ;;
      a)
        install_erizo_api
        ;;
      c)
        install_erizo_controller
        ;;
      s)
        install_spine
        ;;
      t)
        execute_tests
        ;;
      m)
        install_erizo_api_mynode
        ;;  
      f)
        FAST_MAKE="-j$NUM_CORES"
        FAST_BUILD="env JOBS=$NUM_CORES"
        echo "Compiling using $NUM_CORES threads"
        ;;
      d)
        DELETE_OBJECT_FILES='true'
        ;;
      ?)
        usage
        exit
        ;;
    esac
  done
fi

/*global require, exports*/
'use strict';
const events = require('events');
const addon = require('./../../../erizoAPI/build/Release/addon');
const logger = require('./../../common/logger').logger;
const SessionDescription = require('./SessionDescription');
const log = logger.getLogger('Connection');

const CONN_INITIAL        = 101,
      // CONN_STARTED        = 102,
      CONN_GATHERED       = 103,
      CONN_READY          = 104,
      CONN_FINISHED       = 105,
      CONN_CANDIDATE      = 201,
      CONN_SDP            = 202,
      CONN_SDP_PROCESSED  = 203,
      CONN_FAILED         = 500,
      WARN_BAD_CONNECTION = 502;

class Connection extends events.EventEmitter {
  constructor (id, threadPool, ioThreadPool, options = {}) {
    super();
    log.info(`message: constructor, id: ${id}`);
    this.id = id;
    this.threadPool = threadPool;
    this.ioThreadPool = ioThreadPool;
    this.mediaConfiguration = 'default';
    //  {id: stream}
    this.mediaStreams = new Map();
    this.options = options;
    this.trickleIce = options.trickleIce || false;
    this.wrtc = this._createWrtc();
    this.initialized = false;
    this.metadata = this.options.metadata || {};
    this.isProcessingRemoteSdp = false;
    this.ready = false;
  }

  _getMediaConfiguration(mediaConfiguration = 'default') {
    if (global.mediaConfig && global.mediaConfig.codecConfigurations) {
      if (global.mediaConfig.codecConfigurations[mediaConfiguration]) {
        return JSON.stringify(global.mediaConfig.codecConfigurations[mediaConfiguration]);
      } else if (global.mediaConfig.codecConfigurations.default) {
        return JSON.stringify(global.mediaConfig.codecConfigurations.default);
      } else {
        log.warn(
          'message: Bad media config file. You need to specify a default codecConfiguration.'
         );
        return JSON.stringify({});
      }
    } else {
      log.warn(
        'message: Bad media config file. You need to specify a default codecConfiguration.'
      );
      return JSON.stringify({});
    }
  }

  _createWrtc() {
    var wrtc = new addon.WebRtcConnection(this.threadPool, this.ioThreadPool, this.id,
      global.config.erizo.stunserver,
      global.config.erizo.stunport,
      global.config.erizo.minport,
      global.config.erizo.maxport,
      this.trickleIce,
      this._getMediaConfiguration(this.mediaConfiguration),
      global.config.erizo.useNicer,
      global.config.erizo.turnserver,
      global.config.erizo.turnport,
      global.config.erizo.turnusername,
      global.config.erizo.turnpass,
      global.config.erizo.networkinterface);

    if (this.metadata) {
        wrtc.setMetadata(JSON.stringify(this.metadata));
    }
    return wrtc;
  }

  _createMediaStream(id, options = {}, isPublisher = true) {
    log.debug(`message: _createMediaStream, connectionId: ${this.id}, ` +
              `mediaStreamId: ${id}, isPublisher: ${isPublisher}`);
    const mediaStream = new addon.MediaStream(this.threadPool, this.wrtc, id,
      options.label, this._getMediaConfiguration(this.mediaConfiguration), isPublisher);
    mediaStream.id = id;
    mediaStream.label = options.label;
    if (options.metadata) {
      mediaStream.metadata = options.metadata;
      mediaStream.setMetadata(JSON.stringify(options.metadata));
    }
    mediaStream.onMediaStreamEvent((type, message) => {
      this._onMediaStreamEvent(type, message, mediaStream.id);
    });
    return mediaStream;
  }

  _onMediaStreamEvent(type, message, mediaStreamId) {
    let streamEvent = {
      type: type,
      mediaStreamId: mediaStreamId,
      message: message,
    };
    this.emit('media_stream_event', streamEvent);
  }

  _maybeSendAnswer(evt, streamId, forceOffer = false) {
    if (this.isProcessingRemoteSdp) {
      return;
    }
    if (!this.alreadyGathered && !this.trickleIce) {
      return;
    }
    this.wrtc.localDescription = new SessionDescription(this.wrtc.getLocalDescription());
    const sdp = this.wrtc.localDescription.getSdp(this.sessionVersion++);
    let message = sdp.toString();
    message = message.replace(this.options.privateRegexp, this.options.publicIP);

    const info = {type: this.options.createOffer || forceOffer ? 'offer' : 'answer', sdp: message};
    log.debug(`message: _maybeSendAnswer sending event, type: ${info.type}, streamId: ${streamId}`);
    this.emit('status_event', info, evt, streamId);
  }

  init(streamId) {
    if (this.initialized) {
      return false;
    }
    const firstStreamId = streamId;
    this.initialized = true;
    log.debug(`message: Init Connection, connectionId: ${this.id} `+
              `${logger.objectToLog(this.options)}`);
    this.sessionVersion = 0;

    this.wrtc.init((newStatus, mess, streamId) => {
      log.info('message: WebRtcConnection status update, ' +
               'id: ' + this.id + ', status: ' + newStatus +
                ', ' + logger.objectToLog(this.metadata));
      switch(newStatus) {
        case CONN_INITIAL:
          this.emit('status_event', {type: 'started'}, newStatus);
          break;

        case CONN_SDP_PROCESSED:
          this.isProcessingRemoteSdp = false;
          this._maybeSendAnswer(newStatus, streamId);
          break;

        case CONN_SDP:
          this._maybeSendAnswer(newStatus, streamId);
          break;

        case CONN_GATHERED:
          this.alreadyGathered = true;
          this._maybeSendAnswer(newStatus, firstStreamId);
          break;

        case CONN_CANDIDATE:
          mess = mess.replace(this.options.privateRegexp, this.options.publicIP);
          this.emit('status_event', {type: 'candidate', candidate: mess}, newStatus);
          break;

        case CONN_FAILED:
          log.warn('message: failed the ICE process, ' + 'code: ' + WARN_BAD_CONNECTION +
                   ', id: ' + this.id);
          this.emit('status_event', {type: 'failed', sdp: mess}, newStatus);
          break;

        case CONN_READY:
          log.debug('message: connection ready, ' + 'id: ' + this.id +
                    ', ' + 'status: ' + newStatus);
          this.ready = true;
          this.emit('status_event', {type: 'ready'}, newStatus);
          break;
      }
    });
    if (this.options.createOffer) {
      log.debug('message: create offer requested, id:', this.id);
      const audioEnabled = this.options.createOffer.audio;
      const videoEnabled = this.options.createOffer.video;
      const bundle = this.options.createOffer.bundle;
      this.wrtc.createOffer(videoEnabled, audioEnabled, bundle);
    }
    this.emit('status_event', {type: 'initializing'});
    return true;
  }

  addMediaStream(id, options, isPublisher) {
    log.info(`message: addMediaStream, connectionId: ${this.id}, mediaStreamId: ${id}`);
    if (this.mediaStreams.get(id) === undefined) {
      const mediaStream = this._createMediaStream(id, options, isPublisher);
      this.wrtc.addMediaStream(mediaStream);
      this.mediaStreams.set(id, mediaStream);
    }
  }

  removeMediaStream(id) {
    if (this.mediaStreams.get(id) !== undefined) {
      this.wrtc.removeMediaStream(id);
      this.mediaStreams.get(id).close();
      this.mediaStreams.delete(id);
      log.debug(`removed mediaStreamId ${id}, remaining size ${this.getNumMediaStreams()}`);
      this._maybeSendAnswer(CONN_SDP, id, true);
    } else {
      log.error(`message: Trying to remove mediaStream not found, id: ${id}`);
    }
  }

  setRemoteDescription(sdp, streamId) {
    this.isProcessingRemoteSdp = true;
    this.remoteDescription = new SessionDescription(sdp, this.mediaConfiguration);
    this.wrtc.setRemoteDescription(this.remoteDescription.connectionDescription, streamId);
  }

  addRemoteCandidate(candidate) {
    this.wrtc.addRemoteCandidate(candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate);
  }

  getMediaStream(id) {
    return this.mediaStreams.get(id);
  }

  getNumMediaStreams() {
    return this.mediaStreams.size;
  }

  close() {
    log.info(`message: Closing connection ${this.id}`);
    log.info(`message: WebRtcConnection status update, id: ${this.id}, status: ${CONN_FINISHED}, ` +
            `${logger.objectToLog(this.metadata)}`);
    this.mediaStreams.forEach((mediaStream, id) => {
      log.debug(`message: Closing mediaStream, connectionId : ${this.id}, `+
        `mediaStreamId: ${id}`);
      mediaStream.close();
    });
    this.wrtc.close();
    delete this.mediaStreams;
    delete this.wrtc;
  }

}
exports.Connection = Connection;

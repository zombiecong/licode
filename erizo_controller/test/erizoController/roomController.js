/*global require, describe, it, beforeEach, afterEach*/
'use strict';
var mocks = require('../utils');
var sinon = require('sinon');
var expect  = require('chai').expect;

describe('Erizo Controller / Room Controller', function() {
  var amqperMock,
      licodeConfigMock,
      ecchInstanceMock,
      ecchMock,
      spec,
      controller;

  beforeEach(function() {
    global.config = {logger: {configFile: true}, erizoController: {}};
    licodeConfigMock = mocks.start(mocks.licodeConfig);
    amqperMock = mocks.start(mocks.amqper);
    ecchInstanceMock = mocks.ecchInstance;
    ecchMock = mocks.start(mocks.ecch);
    spec = {
      amqper: amqperMock,
      ecch: ecchMock.EcCloudHandler()
    };
    controller = require('../../erizoController/roomController').RoomController(spec);
  });

  afterEach(function() {
    mocks.stop(ecchMock);
    mocks.stop(amqperMock);
    mocks.stop(licodeConfigMock);
    mocks.deleteRequireCache();
    mocks.reset();
    global.config = {logger: {configFile: true}};
  });

  it('should have a known API', function() {
    expect(controller.addEventListener).not.to.be.undefined;  // jshint ignore:line
    expect(controller.addExternalInput).not.to.be.undefined;  // jshint ignore:line
    expect(controller.addExternalOutput).not.to.be.undefined;  // jshint ignore:line
    expect(controller.processSignaling).not.to.be.undefined;  // jshint ignore:line
    expect(controller.addPublisher).not.to.be.undefined;  // jshint ignore:line
    expect(controller.addSubscriber).not.to.be.undefined;  // jshint ignore:line
    expect(controller.removePublisher).not.to.be.undefined;  // jshint ignore:line
    expect(controller.removeSubscriber).not.to.be.undefined;  // jshint ignore:line
    expect(controller.removeSubscriptions).not.to.be.undefined;  // jshint ignore:line
  });

  describe('External Input', function() {
    var kArbitraryId = 'id1',
        kArbitraryUrl = 'url1';

    it('should call Erizo\'s addExternalInput', function() {
      var callback = sinon.stub();
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');

      controller.addExternalInput(kArbitraryId, kArbitraryUrl, callback);
      expect(amqperMock.callRpc.callCount).to.equal(1);
      expect(amqperMock.callRpc.args[0][1]).to.equal('addExternalInput');
    });

    it('should fail if it already exists', function() {
      var callback = sinon.stub();
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');

      controller.addExternalInput(kArbitraryId, kArbitraryUrl, callback);
      expect(amqperMock.callRpc.callCount).to.equal(1);
    });
  });

  describe('External Output', function() {
    var kArbitraryId = 'id1',
        kArbitraryUrl = 'url1',
        kArbitraryOptions = {},
        kArbitraryUnknownId = 'unknownId',
        kArbitraryOutputUrl = 'url2';

    beforeEach(function() {
      var callback = sinon.stub();
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');

      controller.addExternalInput(kArbitraryId, kArbitraryUrl, callback);
    });

    it('should call Erizo\'s addExternalOutput', function() {
      var callback = sinon.stub();
      controller.addExternalOutput(kArbitraryId, kArbitraryUrl, kArbitraryOptions, callback);

      expect(amqperMock.callRpc.callCount).to.equal(2);
      expect(amqperMock.callRpc.args[1][1]).to.equal('addExternalOutput');

      expect(callback.withArgs('success').callCount).to.equal(1);
    });

    it('should fail if it already exists', function() {
      var callback = sinon.stub();
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');

      controller.addExternalOutput(kArbitraryUnknownId, kArbitraryOutputUrl,
        kArbitraryOptions, callback);

      expect(amqperMock.callRpc.callCount).to.equal(1);
      expect(callback.withArgs('error').callCount).to.equal(1);
    });

    describe('Remove', function() {
      beforeEach(function() {
        var callback = sinon.stub();
        controller.addExternalOutput(kArbitraryId, kArbitraryUrl, kArbitraryOptions, callback);
      });

      it('should call Erizo\'s removeExternalOutput', function() {
        var callback = sinon.stub();
        controller.removeExternalOutput(kArbitraryUrl, callback);

        expect(amqperMock.callRpc.callCount).to.equal(3);
        expect(amqperMock.callRpc.args[2][1]).to.equal('removeExternalOutput');

        expect(callback.withArgs(true).callCount).to.equal(1);
      });

      it('should fail if publisher does not exist', function() {
        controller.removePublisher(kArbitraryId, kArbitraryId);
        expect(amqperMock.callRpc.withArgs('ErizoJS_erizoId', 'removePublisher').callCount, 1);
        var cb = amqperMock.callRpc.withArgs('ErizoJS_erizoId', 'removePublisher')
                    .args[0][3].callback;
        cb(true);

        var callback = sinon.stub();
        controller.removeExternalOutput(kArbitraryUrl, callback);

        expect(callback.withArgs(null, 'This stream is not being recorded').callCount).to.equal(1);
      });
    });
  });

  describe('Add Publisher', function() {
    var kArbitraryClientId = 'id1',
        kArbitraryStreamId = 'id2',
        kArbitraryOptions = {};

    it('should call Erizo\'s addPublisher', function() {
      var callback = sinon.stub();
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');

      controller.addPublisher(kArbitraryClientId, kArbitraryStreamId, kArbitraryOptions, callback);

      expect(amqperMock.callRpc.callCount).to.equal(1);
      expect(amqperMock.callRpc.args[0][1]).to.equal('addPublisher');

      amqperMock.callRpc.args[0][3].callback({type: 'initializing'});

      expect(callback.callCount).to.equal(1);
    });

    it('should call send error on erizoJS timeout', function() {
      var callback = sinon.stub();
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'timeout');

      controller.addPublisher(kArbitraryClientId, kArbitraryStreamId, kArbitraryOptions, callback);

      expect(amqperMock.callRpc.callCount).to.equal(0);

      expect(callback.callCount).to.equal(1);
      expect(callback.args[0][0]).to.equal('timeout-agent');
    });

    it('should return error on Publisher timeout', function() {
      var callback = sinon.stub();
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');

      controller.addPublisher(kArbitraryClientId, kArbitraryStreamId, kArbitraryOptions, callback);

      expect(amqperMock.callRpc.callCount).to.equal(1);
      expect(amqperMock.callRpc.args[0][1]).to.equal('addPublisher');

      amqperMock.callRpc.args[0][3].callback('timeout');
      amqperMock.callRpc.args[1][3].callback('timeout');  // First retry
      amqperMock.callRpc.args[2][3].callback('timeout');  // Second retry
      amqperMock.callRpc.args[3][3].callback('timeout');  // Third retry

      expect(callback.callCount).to.equal(1);
      expect(callback.args[0][0]).to.equal('timeout-erizojs');
    });

    it('should fail on callback if it has been already removed', function() {
      var callback = sinon.stub();
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');

      controller.addPublisher(kArbitraryClientId, kArbitraryStreamId, kArbitraryOptions, callback);

      amqperMock.callRpc.args[0][3].callback('timeout');
      amqperMock.callRpc.args[1][3].callback('timeout');  // First retry
      amqperMock.callRpc.args[2][3].callback('timeout');  // Second retry
      amqperMock.callRpc.args[3][3].callback('timeout');  // Third retry

      controller.removePublisher(kArbitraryClientId, kArbitraryStreamId);

      expect(callback.callCount).to.equal(1);
      expect(callback.args[0][0]).to.equal('timeout-erizojs');
    });
  });

  describe('Process Signaling', function() {
    var kArbitraryStreamId = 'id3',
        kArbitraryClientId = 'id4',
        kArbitraryPubOptions = {};

    beforeEach(function() {
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');
      controller.addPublisher(kArbitraryClientId, kArbitraryStreamId,
        kArbitraryPubOptions, sinon.stub());
    });

    it('should call Erizo\'s processSignaling', function() {
      var kArbitraryMsg = 'message';

      controller.processSignaling(null, kArbitraryStreamId, kArbitraryMsg);

      expect(amqperMock.callRpc.callCount).to.equal(2);
      expect(amqperMock.callRpc.args[1][1]).to.equal('processSignaling');
    });
  });

  describe('Add Subscriber', function() {
    var kArbitraryClientId = 'id1',
        kArbitraryOptions = {},
        kArbitraryStreamId = 'id2',
        kArbitraryPubOptions = {};

    beforeEach(function() {
      ecchInstanceMock.getErizoJS.callsArgWith(2, 'erizoId');
      controller.addPublisher(kArbitraryClientId, kArbitraryStreamId,
         kArbitraryPubOptions, sinon.stub());
    });

    it('should call Erizo\'s addSubscriber', function() {
      var callback = sinon.stub();

      controller.addSubscriber(kArbitraryClientId, kArbitraryStreamId,
        kArbitraryOptions, callback);
      expect(amqperMock.callRpc.callCount).to.equal(2);
      expect(amqperMock.callRpc.args[1][1]).to.equal('addSubscriber');

      amqperMock.callRpc.args[1][3].callback({type: 'initializing'});

      expect(callback.callCount).to.equal(1);
    });

    it('should return error on Publisher timeout', function() {
      var callback = sinon.stub();

      controller.addSubscriber(kArbitraryClientId, kArbitraryStreamId,
        kArbitraryOptions, callback);

      expect(amqperMock.callRpc.callCount).to.equal(2);
      expect(amqperMock.callRpc.args[1][1]).to.equal('addSubscriber');

      amqperMock.callRpc.args[1][3].callback('timeout');
      amqperMock.callRpc.args[2][3].callback('timeout');  // First retry
      amqperMock.callRpc.args[3][3].callback('timeout');  // Second retry
      amqperMock.callRpc.args[4][3].callback('timeout');  // Third retry

      expect(callback.callCount).to.equal(1);
      expect(callback.args[0][0]).to.equal('timeout');
    });

    it('should fail if clientId is null', function() {
      var callback = sinon.stub();

      controller.addSubscriber(null, kArbitraryStreamId, kArbitraryOptions, callback);
      expect(amqperMock.callRpc.callCount).to.equal(1);
      expect(callback.args[0][0]).to.equal('Error: null clientId');
    });

    it('should fail if Publisher does not exist', function() {
      var kArbitraryUnknownId = 'unknownId';
      var callback = sinon.stub();

      controller.addSubscriber(kArbitraryClientId, kArbitraryUnknownId,
        kArbitraryOptions, callback);
      expect(amqperMock.callRpc.callCount).to.equal(1);
    });

    describe('And Remove', function() {
      beforeEach(function() {
        controller.addSubscriber(kArbitraryClientId, kArbitraryStreamId,
            kArbitraryOptions, sinon.stub());

        amqperMock.callRpc.args[1][3].callback({type: 'initializing'});
      });

      it('should call Erizo\'s removeSubscriber', function() {
        controller.removeSubscriber(kArbitraryClientId, kArbitraryStreamId);

        expect(amqperMock.callRpc.callCount).to.equal(3);
        expect(amqperMock.callRpc.args[2][1]).to.equal('removeSubscriber');
      });

      it('should fail if subscriberId does not exist', function() {
        var kArbitraryUnknownId = 'unknownId';
        controller.removeSubscriber(kArbitraryUnknownId, kArbitraryStreamId);

        expect(amqperMock.callRpc.callCount).to.equal(2);
      });

      it('should fail if publisherId does not exist', function() {
        var kArbitraryUnknownId = 'unknownId';
        controller.removeSubscriber(kArbitraryClientId, kArbitraryUnknownId);

        expect(amqperMock.callRpc.callCount).to.equal(2);
      });

      it('should call Erizo\'s removeSubscriptions', function() {
        controller.removeSubscriptions(kArbitraryClientId);

        expect(amqperMock.callRpc.callCount).to.equal(3);
        expect(amqperMock.callRpc.args[2][1]).to.equal('removeSubscriber');
      });
    });
  });
});

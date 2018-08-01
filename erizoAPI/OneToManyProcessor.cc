#ifndef BUILDING_NODE_EXTENSION
#define BUILDING_NODE_EXTENSION
#endif

#include "OneToManyProcessor.h"

using v8::Local;
using v8::Value;
using v8::Function;
using v8::FunctionTemplate;
using v8::HandleScope;

Nan::Persistent<Function> OneToManyProcessor::constructor;
// Async Delete OTM

// Classes for Async (not in node main thread) operations
class AsyncDeleter : public Nan::AsyncWorker {
 public:
    AsyncDeleter(erizo::OneToManyProcessor* otm, Nan::Callback *callback):
      AsyncWorker(callback), otmToDelete_(otm) {
      }
    ~AsyncDeleter() {}
    void Execute() {
      otmToDelete_->close();
      delete otmToDelete_;
    }
    void HandleOKCallback() {
      Nan::HandleScope scope;
      std::string msg("OK");
      if (callback) {
        Local<Value> argv[] = {
          Nan::New(msg.c_str()).ToLocalChecked()
        };

        callback->Call(1, argv);
      }
    }
 private:
    erizo::OneToManyProcessor* otmToDelete_;
};

class AsyncRemoveSubscriber : public Nan::AsyncWorker {
 public:
    AsyncRemoveSubscriber(erizo::OneToManyProcessor* otm , const std::string& peerId, Nan::Callback *callback):
      AsyncWorker(callback), otm_(otm), peerId_(peerId) {
      }
    ~AsyncRemoveSubscriber() {}
    void Execute() {
      otm_->removeSubscriber(peerId_);
    }
    void HandleOKCallback() {
      // We're not doing anything here ATM
    }
 private:
    erizo::OneToManyProcessor* otm_;
    std::string peerId_;
};

OneToManyProcessor::OneToManyProcessor() {
}

OneToManyProcessor::~OneToManyProcessor() {
}

NAN_MODULE_INIT(OneToManyProcessor::Init) {
  // Prepare constructor template
  Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("OneToManyProcessor").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  // Prototype
  Nan::SetPrototypeMethod(tpl, "close", close);
  Nan::SetPrototypeMethod(tpl, "setPublisher", setPublisher);
  Nan::SetPrototypeMethod(tpl, "addExternalOutput", addExternalOutput);
  Nan::SetPrototypeMethod(tpl, "setExternalPublisher", setExternalPublisher);
  Nan::SetPrototypeMethod(tpl, "getPublisherState", getPublisherState);
  Nan::SetPrototypeMethod(tpl, "hasPublisher", hasPublisher);
  Nan::SetPrototypeMethod(tpl, "addSubscriber", addSubscriber);
  Nan::SetPrototypeMethod(tpl, "removeSubscriber", removeSubscriber);

  constructor.Reset(tpl->GetFunction());
  Nan::Set(target, Nan::New("OneToManyProcessor").ToLocalChecked(), Nan::GetFunction(tpl).ToLocalChecked());
}

NAN_METHOD(OneToManyProcessor::New) {

  bool disable_remb_rr = info[0]->BooleanValue();

  OneToManyProcessor* obj = new OneToManyProcessor();
  obj->me = new erizo::OneToManyProcessor(disable_remb_rr);
  obj->msink = obj->me;

  obj->Wrap(info.This());
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(OneToManyProcessor::close) {
  OneToManyProcessor* obj = Nan::ObjectWrap::Unwrap<OneToManyProcessor>(info.Holder());
  erizo::OneToManyProcessor *me = (erizo::OneToManyProcessor*)obj->me;
  Nan::Callback *callback;
  if (info.Length() >= 1) {
    callback = new Nan::Callback(info[0].As<Function>());
  } else {
    callback = NULL;
  }

  Nan::AsyncQueueWorker(new  AsyncDeleter(me, callback));
}

NAN_METHOD(OneToManyProcessor::setPublisher) {
  OneToManyProcessor* obj = Nan::ObjectWrap::Unwrap<OneToManyProcessor>(info.Holder());
  erizo::OneToManyProcessor *me = (erizo::OneToManyProcessor*)obj->me;

  MediaStream* param = Nan::ObjectWrap::Unwrap<MediaStream>(Nan::To<v8::Object>(info[0]).ToLocalChecked());
  auto wr = std::shared_ptr<erizo::MediaStream>(param->me);

  std::shared_ptr<erizo::MediaSource> ms = std::dynamic_pointer_cast<erizo::MediaSource>(wr);
  me->setPublisher(ms);
}

NAN_METHOD(OneToManyProcessor::addExternalOutput) {
  OneToManyProcessor* obj = Nan::ObjectWrap::Unwrap<OneToManyProcessor>(info.Holder());
  erizo::OneToManyProcessor *me = (erizo::OneToManyProcessor*)obj->me;

  ExternalOutput* param = Nan::ObjectWrap::Unwrap<ExternalOutput>(Nan::To<v8::Object>(info[0]).ToLocalChecked());
  std::shared_ptr<erizo::ExternalOutput> wr = param->me;

  auto ms = std::dynamic_pointer_cast<erizo::MediaSink>(wr);

  // get the param
  v8::String::Utf8Value param1(Nan::To<v8::String>(info[1]).ToLocalChecked());

  // convert it to string
  std::string peerId = std::string(*param1);
  me->addSubscriber(ms, peerId);
}

NAN_METHOD(OneToManyProcessor::setExternalPublisher) {
  OneToManyProcessor* obj = Nan::ObjectWrap::Unwrap<OneToManyProcessor>(info.Holder());
  erizo::OneToManyProcessor *me = (erizo::OneToManyProcessor*)obj->me;

  ExternalInput* param = Nan::ObjectWrap::Unwrap<ExternalInput>(Nan::To<v8::Object>(info[0]).ToLocalChecked());
  std::shared_ptr<erizo::ExternalInput> wr = param->me;

  std::shared_ptr<erizo::MediaSource> ms = std::dynamic_pointer_cast<erizo::MediaSource>(wr);
  me->setPublisher(ms);
}

NAN_METHOD(OneToManyProcessor::getPublisherState) {
  OneToManyProcessor* obj = Nan::ObjectWrap::Unwrap<OneToManyProcessor>(info.Holder());
  erizo::OneToManyProcessor *me = (erizo::OneToManyProcessor*)obj->me;

  auto wr = std::dynamic_pointer_cast<erizo::MediaStream>(me->publisher);

  int state = wr->getCurrentState();
  info.GetReturnValue().Set(Nan::New(state));
}

NAN_METHOD(OneToManyProcessor::hasPublisher) {
  OneToManyProcessor* obj = Nan::ObjectWrap::Unwrap<OneToManyProcessor>(info.Holder());
  erizo::OneToManyProcessor *me = (erizo::OneToManyProcessor*)obj->me;

  bool p = true;

  if (me->publisher == NULL) {
    p = false;
  }

  info.GetReturnValue().Set(Nan::New(p));
}

NAN_METHOD(OneToManyProcessor::addSubscriber) {
  OneToManyProcessor* obj = Nan::ObjectWrap::Unwrap<OneToManyProcessor>(info.Holder());
  erizo::OneToManyProcessor *me = (erizo::OneToManyProcessor*)obj->me;

  MediaStream* param = Nan::ObjectWrap::Unwrap<MediaStream>(Nan::To<v8::Object>(info[0]).ToLocalChecked());
  auto wr = std::shared_ptr<erizo::MediaStream>(param->me);

  std::shared_ptr<erizo::MediaSink> ms = std::dynamic_pointer_cast<erizo::MediaSink>(wr);
  // get the param
  v8::String::Utf8Value param1(Nan::To<v8::String>(info[1]).ToLocalChecked());

  // convert it to string
  std::string peerId = std::string(*param1);
  me->addSubscriber(ms, peerId);
}

NAN_METHOD(OneToManyProcessor::removeSubscriber) {
  OneToManyProcessor* obj = Nan::ObjectWrap::Unwrap<OneToManyProcessor>(info.Holder());
  erizo::OneToManyProcessor *me = (erizo::OneToManyProcessor*)obj->me;

  // get the param
  v8::String::Utf8Value param1(Nan::To<v8::String>(info[0]).ToLocalChecked());

  // convert it to string
  std::string peerId = std::string(*param1);
  Nan::AsyncQueueWorker(new  AsyncRemoveSubscriber(me, peerId, NULL));
}

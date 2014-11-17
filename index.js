var Transform = require('stream').Transform;
var PassThrough = require('stream').PassThrough;
var util = require('util');

// color space component counts
var components = {
  'rgb': 3,
  'rgba': 4,
  'cmyk': 4,
  'gray': 1,
  'graya': 2,
  'indexed': 1
};

// pixel stream states
var START = 0;
var FRAME_START = 1;
var FRAME_DATA = 2;
var FRAME_END = 3;

var EMPTY_BUFFER = new Buffer(0);

function PixelStream(width, height, opts) {
  Transform.call(this);
  
  if (typeof width === 'object') {
    opts = width;
    width = height = 0;
  }
  
  this.width = width || 0;
  this.height = height || 0;
  this.colorSpace = (opts && opts.colorSpace) || this.colorSpace || 'rgb';
  this._frameSize = this.width * this.height * components[this.colorSpace];
  
  this._consumed = 0;
  this._state = START;
  this._frameQueue = [];
  var self = this;
    
  this.once('pipe', function(src) {
    function update() {
      if (src.width && src.height) {
        self.width = src.width;
        self.height = src.height;
        self.colorSpace = src.colorSpace || 'rgb';
        self._frameSize = src.width * src.height * components[self.colorSpace];
        self.emit('format', src);
      }
    }
    
    src.once('format', update);
    update();
    
    src.on('frame', this.addFrame.bind(this));
  });
}

util.inherits(PixelStream, Transform);

/**
 * Adds a frame metadata object to the frame queue.
 * This object can represent any information about
 * the frame, such as its size, and will be used
 * when the frame is reached in the data stream.
 */
PixelStream.prototype.addFrame = function(frame) {
  this._frameQueue.push(frame);
};

// Transform stream implementation
PixelStream.prototype._transform = function(data, encoding, done) {
  var self = this;
    
  // recursive state machine to consume the given data by
  // calling the correct sequence of functions on our subclass
  function write(data) {    
    switch (self._state) {
      case START:
        self._start(function(err) {
          if (err) return done(err);
          self._state = FRAME_START;
          write(data);
        });
        
        break;
        
      case FRAME_START:
        var frame = self._frameQueue.shift() || {};
        
        // if the frame object has width and height
        // properties, recompute the frame size.
        if (frame.width && frame.height)
          self._frameSize = frame.width * frame.height * components[self.colorSpace];
        
        self._startFrame(frame, function(err) {
          if (err) return done(err);
          self.emit('frame', frame);
          self._state = FRAME_DATA;
          write(data);
        });
        
        break;
        
      case FRAME_DATA:        
        if (data.length === 0)
          return done();
          
        // if the frame size is zero, just call frame end
        if (self._frameSize === 0) {
          self._state = FRAME_END;
          write(EMPTY_BUFFER);
          break;
        }
        
        var chunk = data.slice(0, self._frameSize - self._consumed);
        self._writePixels(chunk, function(err) {
          if (err) return done(err);
          
          self._consumed += chunk.length;
          if (self._consumed === self._frameSize)
            self._state = FRAME_END;
            
          write(data.slice(chunk.length));
        });
        
        break;
        
      case FRAME_END:
        self._endFrame(function(err) {
          if (err) return done(err);
          
          self._consumed = 0;
          self._state = FRAME_START;
          if (data.length)
            write(data);
          else
            done();
        });
        
        break;
    }
  }
  
  write(data);
};

PixelStream.prototype._flush = function(done) {
  this._end(done);
};

/**
 * For optional implementation by subclasses.
 * Called before the start of the first frame.
 * Implementations should the callback when done.
 */
PixelStream.prototype._start = function(done) {
  done();
};

/**
 * For optional implementation by subclasses.
 * Called at the start of each frame, including the
 * frame metadata. Implementations should the callback 
 * when done.
 */
PixelStream.prototype._startFrame = function(frame, done) {
  done();
};

/**
 * Required to be implemented by subclasses.
 * Called to write pixel data to the current frame.
 */
PixelStream.prototype._writePixels = function(data, done) {
  done(new Error('No _writePixels implementation'));
};

/**
 * For optional implementation by subclasses.
 * Called after each frame has been written.
 */
PixelStream.prototype._endFrame = function(done) {
  done();
};

/**
 * For optional implementation by subclasses.
 * Called after all frames have been written.
 */
PixelStream.prototype._end = function(done) {
  done();
};

module.exports = PixelStream;

var inherits = require('util').inherits;
var PixelStream = require('../');
var assert = require('assert');
var PassThrough = require('stream').PassThrough;

describe('pixel-stream', function() {
  describe('constructor', function() {
    it('should allow optional width and height', function() {    
      var s = new PixelStream(100, 100);
      assert.deepEqual(s.format, {
        width: 100,
        height: 100,
        colorSpace: 'rgb'
      });
    });
    
    it('should allow colorSpace option', function() {
      var s = new PixelStream({ colorSpace: 'rgba' });
      assert.deepEqual(s.format, {
        width: 0,
        height: 0,
        colorSpace: 'rgba'
      });
    });
    
    it('should allow any other options', function() {
      var s = new PixelStream({ foo: 2, bar: 'hi' });
      assert.deepEqual(s.format, {
        width: 0,
        height: 0,
        colorSpace: 'rgb',
        foo: 2,
        bar: 'hi'
      });
    });
  
    it('should allow both size and options', function() {
      var s = new PixelStream(100, 100, { colorSpace: 'rgba' });
      assert.deepEqual(s.format, {
        width: 100,
        height: 100,
        colorSpace: 'rgba'
      });
    });
    
    it('should compute frame size', function() {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
      }
      inherits(TestPixelStream, PixelStream);

      TestPixelStream.prototype._writePixels = function(data, done) {
        done();
      };
      
      var s = new TestPixelStream(100, 100);
      s.end(new Buffer(100 * 100 * 3 * 2));
      
      assert.equal(s._frameSize, 100 * 100 * 3);
    });
    
    it('should compute frame size for another color space', function() {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
      }
      inherits(TestPixelStream, PixelStream);

      TestPixelStream.prototype._writePixels = function(data, done) {
        done();
      };
      
      var s = new TestPixelStream(100, 100, { colorSpace: 'graya' });
      s.end(new Buffer(100 * 100 * 2 * 2));
      
      assert.equal(s._frameSize, 100 * 100 * 2);
    });
    
    it('should receive and update from format events of piped source', function(done) {
      var p = new PassThrough;
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
      }
      inherits(TestPixelStream, PixelStream);

      TestPixelStream.prototype._writePixels = function(data, done) {
        done();
      };
      
      var s = new TestPixelStream;
      
      // should forward format event
      s.on('format', function() {
        assert.deepEqual(s.format, {
          width: 200,
          height: 100,
          colorSpace: 'rgba'
        });
        assert.equal(s._frameSize, 200 * 100 * 4);
        done();
      });
      
      p.pipe(s);
      
      // didn't update yet
      assert.equal(s.format.width, 0);
      p.emit('format', {
        width: 200,
        height: 100,
        colorSpace: 'rgba'
      });
      
      p.end(new Buffer(200 * 100 * 4 * 2));
    });
  });
  
  describe('methods', function() {
    it('should require subclass to implement _writePixels', function(done) {
      var s = new PixelStream(10, 10);
      s.on('error', function(err) {
        assert(err);
        assert(err instanceof Error);
        assert.equal(err.message, 'No _writePixels implementation');
        done();
      });
    
      s.end(new Buffer(10));
    });
        
    it('should get all data', function(done) {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
        this.len = 0;
      }
      inherits(TestPixelStream, PixelStream);

      TestPixelStream.prototype._writePixels = function(data, done) {
        this.len += data.length;
        done();
      };
      
      var s = new TestPixelStream(10, 10);
      for (var i = 0; i < 10; i++)
        s.write(new Buffer(10 * 3));
        
      s.end(function() {
        assert.equal(s.len, 10 * 10 * 3);
        done();
      });
    });
    
    it('should not call _writePixels if frame size is zero', function(done) {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
        this.called = false;
      }
      inherits(TestPixelStream, PixelStream);

      TestPixelStream.prototype._writePixels = function(data, done) {
        this.called = true;
        done();
      };
      
      var s = new TestPixelStream;      
      s.end(new Buffer(10), function() {
        assert.equal(s.called, false);
        done();
      });
    });
    
    it('calls all methods in sequence', function(done) {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
        this.ops = [];
        this.len = 0;
      }
      inherits(TestPixelStream, PixelStream);
      
      TestPixelStream.prototype._start = function(done) {
        assert.deepEqual(this.format, {
          width: 10,
          height: 10,
          colorSpace: 'rgb'
        });
        
        this.ops.push('start');
        done();
      };
      
      TestPixelStream.prototype._startFrame = function(frame, done) {
        assert.equal(typeof frame, 'object');
        this.ops.push('startFrame');
        done();
      };

      TestPixelStream.prototype._writePixels = function(data, done) {
        this.len += data.length;
        this.ops.push('writePixels');
        done();
      };
      
      TestPixelStream.prototype._endFrame = function(done) {
        this.ops.push('endFrame');
        done();
      };
      
      TestPixelStream.prototype._end = function(done) {
        this.ops.push('end');
        done();
      };
      
      var s = new TestPixelStream(10, 10);
      for (var i = 0; i < 10 * 4; i++)
        s.write(new Buffer(10 * 3));
        
      s.end(function() {
        assert.equal(s.len, 10 * 10 * 3 * 4);
        assert.deepEqual(s.ops, [
          'start',
          'startFrame',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'endFrame',
          'startFrame',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'endFrame',
          'startFrame',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'endFrame',
          'startFrame',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'endFrame',
          'end'
        ]);
        done();
      });
    });
    
    it('works asynchronously', function(done) {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
        this.ops = [];
        this.len = 0;
      }
      inherits(TestPixelStream, PixelStream);
      
      TestPixelStream.prototype._start = function(done) {
        this.ops.push('start');
        setTimeout(done, Math.random() * 10);
      };
      
      TestPixelStream.prototype._startFrame = function(frame, done) {
        this.ops.push('startFrame');
        setTimeout(done, Math.random() * 10);
      };

      TestPixelStream.prototype._writePixels = function(data, done) {
        this.len += data.length;
        this.ops.push('writePixels');
        setTimeout(done, Math.random() * 10);
      };
      
      TestPixelStream.prototype._endFrame = function(done) {
        this.ops.push('endFrame');
        setTimeout(done, Math.random() * 10);
      };
      
      TestPixelStream.prototype._end = function(done) {
        this.ops.push('end');
        setTimeout(done, Math.random() * 10);
      };
      
      var s = new TestPixelStream(10, 10);
      for (var i = 0; i < 10 * 4; i++)
        s.write(new Buffer(10 * 3));
        
      s.end(function() {
        assert.equal(s.len, 10 * 10 * 3 * 4);
        assert.deepEqual(s.ops, [
          'start',
          'startFrame',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'endFrame',
          'startFrame',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'endFrame',
          'startFrame',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'endFrame',
          'startFrame',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'writePixels', 'writePixels', 'writePixels', 'writePixels', 'writePixels',
          'endFrame',
          'end'
        ]);
        done();
      });
    });
    
    it('sends frame metadata objects', function(done) {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
        this.frames = [];
      }
      inherits(TestPixelStream, PixelStream);
            
      TestPixelStream.prototype._startFrame = function(frame, done) {
        assert.equal(typeof frame, 'object');
        this.frames.push(frame);
        done();
      };

      TestPixelStream.prototype._writePixels = function(data, done) {
        done();
      };
      
      var s = new TestPixelStream(10, 10);
      s.addFrame({ index: 0 });
      s.addFrame({ index: 1 });
      s.addFrame({ index: 2 });
      s.addFrame({ index: 3 });
      
      var emittedFrames = [];
      s.on('frame', function(frame) {
        emittedFrames.push(frame);
      });
      
      for (var i = 0; i < 10 * 4; i++)
        s.write(new Buffer(10 * 3));
        
      s.end(function() {
        assert.deepEqual(s.frames, [
          { index: 0 },
          { index: 1 },
          { index: 2 },
          { index: 3 }
        ]);
        assert.deepEqual(emittedFrames, [
          { index: 0 },
          { index: 1 },
          { index: 2 },
          { index: 3 }
        ]);
        done();
      });
    });
    
    it('sends frame metadata objects piped from another stream', function(done) {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
        this.frames = [];
      }
      inherits(TestPixelStream, PixelStream);
            
      TestPixelStream.prototype._startFrame = function(frame, done) {
        assert.equal(typeof frame, 'object');
        this.frames.push(frame);
        done();
      };

      TestPixelStream.prototype._writePixels = function(data, done) {
        done();
      };
      
      var s = new TestPixelStream;
      var p = new PassThrough;
      
      p.pipe(s);
      
      p.emit('format', {
        width: 10,
        height: 10,
        colorSpace: 'rgb'
      });
      
      p.emit('frame', { index: 0 });
      p.emit('frame', { index: 1 });
      p.emit('frame', { index: 2 });
      p.emit('frame', { index: 3 });
      
      var emittedFrames = [];
      s.on('frame', function(frame) {
        emittedFrames.push(frame);
      });
            
      for (var i = 0; i < 10 * 4; i++)
        p.write(new Buffer(10 * 3));
        
      p.end(function() {
        assert.deepEqual(s.frames, [
          { index: 0 },
          { index: 1 },
          { index: 2 },
          { index: 3 }
        ]);
        assert.deepEqual(emittedFrames, [
          { index: 0 },
          { index: 1 },
          { index: 2 },
          { index: 3 }
        ]);
        done();
      });
    });
    
    it('recomputes frame size if frame object has a width and height', function(done) {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
        this.ops = [];
        this.len = 0;
      }
      inherits(TestPixelStream, PixelStream);
      
      TestPixelStream.prototype._start = function(done) {
        this.ops.push('start');
        done();
      };
      
      TestPixelStream.prototype._startFrame = function(frame, done) {
        assert.equal(typeof frame, 'object');
        this.ops.push('startFrame');
        done();
      };

      TestPixelStream.prototype._writePixels = function(data, done) {
        this.len += data.length;
        this.ops.push('writePixels');
        done();
      };
      
      TestPixelStream.prototype._endFrame = function(done) {
        this.ops.push('endFrame');
        done();
      };
      
      TestPixelStream.prototype._end = function(done) {
        this.ops.push('end');
        done();
      };
      
      var s = new TestPixelStream(10, 10);
      
      s.addFrame({ width: 100, height: 100 });
      s.write(new Buffer(100 * 100 * 3));
      
      s.addFrame({ width: 10, height: 10 });
      s.write(new Buffer(10 * 10 * 3));      
        
      s.end(function() {
        assert.equal(s.len, 100 * 100 * 3 + 10 * 10 * 3);
        assert.deepEqual(s.ops, [
          'start',
          'startFrame',
          'writePixels',
          'endFrame',
          'startFrame',
          'writePixels',
          'endFrame',
          'end'
        ]);
        done();
      });
    });
    
    it('recomputes frame size from frame object correctly when input color space != output color space', function(done) {
      function TestPixelStream() {
        PixelStream.apply(this, arguments);
        this.ops = [];
        this.len = 0;
      }
      inherits(TestPixelStream, PixelStream);
      
      TestPixelStream.prototype._start = function(done) {
        this.format.colorSpace = 'rgba';
        this.ops.push('start');
        done();
      };
      
      TestPixelStream.prototype._startFrame = function(frame, done) {
        assert.equal(typeof frame, 'object');
        this.ops.push('startFrame');
        done();
      };

      TestPixelStream.prototype._writePixels = function(data, done) {
        this.len += data.length;
        this.ops.push('writePixels');
        done();
      };
      
      TestPixelStream.prototype._endFrame = function(done) {
        this.ops.push('endFrame');
        done();
      };
      
      TestPixelStream.prototype._end = function(done) {
        this.ops.push('end');
        done();
      };
      
      var s = new TestPixelStream(10, 10);
      
      s.addFrame({ width: 100, height: 100 });
      s.write(new Buffer(100 * 100 * 3));
      assert.equal(s._frameSize, 100 * 100 * 3);
      
      s.addFrame({ width: 10, height: 10 });
      s.write(new Buffer(10 * 10 * 3));
      assert.equal(s._frameSize, 10 * 10 * 3);     
        
      s.end(function() {
        assert.equal(s.len, 100 * 100 * 3 + 10 * 10 * 3);
        assert.deepEqual(s.ops, [
          'start',
          'startFrame',
          'writePixels',
          'endFrame',
          'startFrame',
          'writePixels',
          'endFrame',
          'end'
        ]);
        done();
      });
    });
  });
});

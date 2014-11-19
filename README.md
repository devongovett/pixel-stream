# pixel-stream

`PixelStream` is a base transform stream class for image pixel data.
It propagates image metadata such as size and color space between piped streams,
and makes working with images of multiple frames (e.g. animated GIFs!) much easier.

## Installation

    npm install pixel-stream

## API for Consumers

`PixelStream` is a Node [transform stream](http://nodejs.org/api/stream.html#stream_class_stream_transform).
You can write data to it manually, or pipe data to it from another stream.  You can pipe more than one
frame of data (as in an animated image), and the `PixelStream` will handle this properly.

### `PixelStream(width = 0, height = 0, options = {})`

The constructor for a `PixelStream` accepts three optional arguments: `width`, `height`, and an 
object for other options.  If you are not piping another stream into this one that has these
properties, `width` and `height` are required.  One additional option handled by the `PixelStream`
base class is `colorSpace`, described below, which is set to 'rgb' by default. Other options can
be handled by subclasses.

### `format`

An object describing characteristics about the image, such as its `width`, `height`,
`colorSpace` (e.g. rgb, rgba, gray, cmyk, etc.), and other properties.

### `addFrame(frame)`

This method adds a frame metadata object describing the characteristics of a frame in an
animated image. This does not include the actual pixel data for the frame, which is written
through the stream in the usual way. It just describes characteristics such as frame size, etc.
This frame object can be used by `PixelStream` subclasses, such as encoders, and is 
passed on to `PixelStream`s further down the pipes by emitting `frame` events (described below).

### `'format'` event

If this event is emitted by a source stream (e.g. image decoder), which is then piped to a 
`PixelStream`, the `PixelStream` will use this opportunity to learn about the above image
characteristics from the source stream automatically. A format object, as described above,
should be passed as an argument to the event.

```javascript
fs.createReadStream('in.png')
  .pipe(new PNGDecoder)
  .pipe(new MyPixelStream)
```

In the above example, the instance of `MyPixelStream` is not initialized with a `width`, `height`,
or `colorSpace` since it learns those characteristics automatically when the `PNGDecoder` emits
a `'format'` event.

### `'frame'` event

If this event is emitted by a source stream (e.g. image decoder), which is then piped to a 
`PixelStream`, the frame object is added to the frame queue through the `addFrame` method 
described above.

## API for Subclasses

The following methods can be implemented by subclasses to provide useful behavior. 
Only `_writePixels` is required.

### `_start(callback)`

This method is called at the start of the stream, before any data has been passed to `_writePixels`.
You should call the provided callback when you are done.

### `_startFrame(frame, callback)`

This method is called at the start of each frame, before any data for this frame has been passed to
`_writePixels`. It is passed a frame metadata object, which either came from a call to `addFrame` or
piped from another stream (described above).  You should call the provided callback when you are done.

### `_writePixels(data, callback)`

This method is called with the actual pixel data for a frame (not necessarily all at once).
You should call the provided callback when you are done. This is the only method that you MUST implement.

### `_endFrame(callback)`

This method is called at the end of each frame, after all data for the frame has been passed to `_writePixels`.
You should call the provided callback when you are done.

### `_end(callback)`

This method is called at the end of the entire data stream for all frames.
You should call the provided callback when you are done.

## Example

`PixelStream` is an abstract class, which means it doesn't do much by itself. You need to extend it
with your functionality to make it useful.

The following example converts RGB images to grayscale.

```javascript
var PixelStream = require('pixel-stream');
var inherits = require('util').inherits;

function MyPixelStream() {
  PixelStream.apply(this, arguments);
}

inherits(MyPixelStream, PixelStream);

MyPixelStream.prototype._writePixels = function(data, done) {
  if (this.colorSpace !== 'rgb')
    return done(new Error('Only supports rgb input'));
  
  var res = new Buffer(data.length / 3);
  var i = 0, j = 0;
  
  while (i < data.length) {
    res[j++] = 0.2126 * data[i++] + 
               0.7152 * data[i++] + 
               0.0722 * data[i++];
  }
  
  this.push(res);
  done();
};
```

## License

MIT

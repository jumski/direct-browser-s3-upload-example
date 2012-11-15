function createCORSRequest(method, url)
{
  var xhr = new XMLHttpRequest();
  if ("withCredentials" in xhr)
  {
    xhr.open(method, url, true);
  }
  else if (typeof XDomainRequest != "undefined")
  {
    xhr = new XDomainRequest();
    xhr.open(method, url);
  }
  else
  {
    xhr = null;
  }
  return xhr;
}

function handleFileSelect(evt)
{
  setProgress(0, 'Upload started.');

  var files = evt.target.files;

  onResizeFiles(files, function(dataURI){
    var blob = dataURLToBlob(dataURI);
    uploadFile(blob);
  });

  // var output = [];
  // for (var i = 0, f; f = files[i]; i++)
  // {
  //   // console.log(f);
  //   // uploadFile(f);
  // }
}

function onResizeFiles(files, callback)
{
  var file = files[0];
  var img = document.createElement('img');
  var reader = new FileReader();

  img.onload = function(e) {
    // Create a canvas with the desired dimensions
    var canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;

    // Scale and draw the source image to the canvas
    canvas.getContext("2d").drawImage(img, 0, 0, 50, 50);

    // Convert the canvas to a data URL in PNG format
    callback(canvas.toDataURL());
  }

  reader.onload = function(e) {
    // var canvas = document.getElementById('canvas');
    // canvas.width = 50;
    // canvas.height = 50;

    // var context = canvas.getContext('2d');

    // context.drawImage(img, 0, 0);
    img.src = e.target.result;
    // callback(canvas.toDataURL('image/jpg'));
  }
  reader.readAsDataURL(file);
}

// https://github.com/ebidel/filer.js/blob/master/src/filer.js#L128
function dataURLToBlob(dataURL) {
  var BASE64_MARKER = ';base64,';
  if (dataURL.indexOf(BASE64_MARKER) == -1) {
    var parts = dataURL.split(',');
    var contentType = parts[0].split(':')[1];
    var raw = parts[1];

    return new Blob([raw], {type: contentType});
  }

  var parts = dataURL.split(BASE64_MARKER);
  var contentType = parts[0].split(':')[1];
  var raw = window.atob(parts[1]);
  var rawLength = raw.length;

  var uInt8Array = new Uint8Array(rawLength);

  for (var i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], {type: contentType});
}

/**
 * Execute the given callback with the signed response.
 */
function executeOnSignedUrl(file, callback)
{
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'signput?name=' + file.name + '&type=' + file.type, true);

  // Hack to pass bytes through unprocessed.
  xhr.overrideMimeType('text/plain; charset=x-user-defined');

  xhr.onreadystatechange = function(e)
  {
    if (this.readyState == 4 && this.status == 200)
    {
      callback(decodeURIComponent(this.responseText));
    }
    else if(this.readyState == 4 && this.status != 200)
    {
      setProgress(0, 'Could not contact signing script. Status = ' + this.status);
    }
  };

  xhr.send();
}

function uploadFile(file)
{
  executeOnSignedUrl(file, function(signedURL)
  {
    uploadToS3(file, signedURL);
  });
}

/**
 * Use a CORS call to upload the given file to S3. Assumes the url
 * parameter has been signed and is accessible for upload.
 */
function uploadToS3(file, url)
{
  var xhr = createCORSRequest('PUT', url);
  if (!xhr)
  {
    setProgress(0, 'CORS not supported');
  }
  else
  {
    xhr.onload = function()
    {
      if(xhr.status == 200)
      {
        setProgress(100, 'Upload completed.');
      }
      else
      {
        setProgress(0, 'Upload error: ' + xhr.status);
      }
    };

    xhr.onerror = function()
    {
      setProgress(0, 'XHR error.');
    };

    xhr.upload.onprogress = function(e)
    {
      if (e.lengthComputable)
      {
        var percentLoaded = Math.round((e.loaded / e.total) * 100);
        setProgress(percentLoaded, percentLoaded == 100 ? 'Finalizing.' : 'Uploading.');
      }
    };

    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-amz-acl', 'public-read');

    xhr.send(file);
  }
}

function setProgress(percent, statusLabel)
{
  var progress = document.querySelector('.percent');
  progress.style.width = percent + '%';
  progress.textContent = percent + '%';
  document.getElementById('progress_bar').className = 'loading';

  document.getElementById('status').innerText = statusLabel;
}

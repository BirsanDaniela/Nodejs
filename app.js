var express = require('express');
var app = express();
var path = require('path');
var mongoose = require('mongoose');
var generator = require('./generator.js');
var config = require('./config');
var bodyParser = require('body-parser');
var Url = require('./models/url');
var Client = require('./models/client');
var UAParser = require('ua-parser-js');
var multer  =   require('multer');
var storage =   multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, './uploads');
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + '-' + Date.now());
  }
});
var upload = multer({ storage : storage}).single('image');

mongoose.connect('mongodb://' + config.db.host + '/' + config.db.name);
mongoose.connection.on('error', function(err) {
    console.error('MongoDB error: %s', err);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.post('/shorten', function(req, res){
  var longUrl = req.body.url;
  var shortUrl = '';

  Url.findOne({long_url: longUrl}, function (err, doc){
    if (doc){
      shortUrl = doc.short_url;
    }
    else {
	var unique = false;
  var verify;
	while(unique == false){
 		shortUrl = generator.generate();
		Url.findOne({short_url: shortUrl}, function (err, result){
      verify = result;
		});
    if(verify == null){
      unique = true;
	}
}
      var newUrl = Url({
        long_url: longUrl,
		short_url: shortUrl
      });

      newUrl.save(function(err) {
        if (err){
          console.log(err);
        }
      });
    }
    res.send({'shortUrl': config.webhost + shortUrl});
    res.end();
    });
});

app.get('/:code', function(req, res){
  var code = req.params.code;
  if(code.length == 5){
  var parser = new UAParser();
  var ua = req.headers['user-agent'];
  var referrer = req.headers.referrer || req.headers.referer;
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var browserName = parser.setUA(ua).getBrowser().name;
  var fullBrowserVersion = parser.setUA(ua).getBrowser().version;
  var browserVersion = fullBrowserVersion.split(".",1).toString();
  var osName = parser.getOS().name;
  var osVersion = parser.getOS().version;

  var user = new Client({
    code: code,
    browser_name: browserName,
    browser_version: browserVersion,
    so_name: osName,
    so_version: osVersion,
    ip: ip,
    referrer: referrer
  });

  user.save(function(err) {
    if (err){
      console.log(err);
    }
  });
}
  Url.findOne({short_url: code}, function (err, doc){
    if (doc) {
      var urlToRedirect;
      if(doc.long_url.substring(0, 3) == 'www'){
        urlToRedirect = 'http://' + doc.long_url;
      }
        else {
          urlToRedirect = doc.long_url
        }
        res.redirect(urlToRedirect);
    } else {
      res.redirect(config.webhost);
    }
  });
});

app.post('/upload',function(req,res){
    upload(req,res,function(err) {
        if(err) {
            return res.end("Error uploading file.");
        }
        res.end("File is uploaded");
    });
  });

app.get('/admin/mostVisitedSite/data', function(req, res){

  var data;
  var agg = [
   {$group: {
     _id: "$code",
     count: {$sum: 1}
   }},
  { "$sort": { "count": -1 } },
  { "$limit": 3 }
 ];


 Client.aggregate(agg, function(err, doc){
   res.send({'data': doc});
   res.end();
 });
});

app.get('/admin/mostVisitedSite', function(req, res){
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

var server = app.listen(3000, function(){
  console.log('Server listening on port 3000');
});

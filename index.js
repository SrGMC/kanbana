// Load node modules.
var fs = require('fs');
var path = require('path');
var marked = require('marked');
var express = require('express');
var app = express();

var cache = [];
var maxTime = 10;

function isCached(path){
  for (var i = 0; i < cache.length; i++) {
    if(cache[i].path === path){
      return {response: true, index: i};
    }
  }
  return {response: false, index: -1};
}

function gc(){
  var now = new Date();
  for (var i = 0; i < cache.length; i++) {
    if(now - cache[i].time >= 10*60*1000){
      cache.splice(i, 1);
    }
  }
}

// Custom renderer for Marked.
var markedRenderer = new marked.Renderer();

// Heading callback for renderer.
markedRenderer.heading = function(text, level) {
  var prefix = '<h' + level + '>';
  // Wrap in a div if h1
  if (level == 1) {
    var cssClasses = ['board__card'];

    // Add collapsible helpers.
    if (text.match("\\[(\\-)\\]", "gi")) {
      cssClasses.push('board__card--collapsible');
      text = text.replace(/\[\-\]\s?/gi, "");
    }

    // Add a custom board name.
    var name = text.toLowerCase().replace(/[^\w]+/g, '-');
    cssClasses.push('board__card--' + name);

    prefix = '<div class="' + cssClasses.join(" ") + '">' + prefix;
  }

  return prefix + text + '</h' + level + '>';
};

// List callback for renderer.
markedRenderer.list = function(body, ordered) {
  var type = ordered ? 'ol' : 'ul';

  // Add Checkboxes
  body = addCheckboxes(body);

  // Create timers
  body = addTimersDays(body);
  body = addTimersHours(body);
  body = addTimersMinutes(body);

  // Create labels.
  body = labelize(body);

  // Create span
  //body = spanize(body);

  // Add a suffix. See markedRenderer.heading.
  var suffix = '</div>';

  return '<' + type + '>\n' + body + '</' + type + '>' + suffix + '\n';
};

marked.setOptions({
  renderer: markedRenderer,
  pedantic: false,
  gfm: true,
  tables: false,
  breaks: false,
  sanitize: false,
  smartLists: true,
  smartypants: false,
  xhtml: false
});

app.get('/\*', function(request, response){
  var reqpath = __dirname + "/boards" + request.path + ((request.path.indexOf(".md") === -1) ? ".md" : "");
  if(request.path.indexOf(".css") !== -1 || request.path.indexOf(".js") !== -1){
    response.status(200).sendFile(__dirname + request.path);
    return;
  }
  var cached = isCached(reqpath);
  if(cached.response){
    console.log(request.ip + ": sending cached " + reqpath);
    response.type('.html');
    response.status(200).send(cache[cached.index].html);
    return;
  }
  fs.readFile(reqpath, 'utf8', function (err,data) {
    if (err) {
      response.status(404).send();
      return;
    }
    console.log(request.ip + ": " + reqpath);
    var head = "{" + data.match(/(---)\n.+\n.+\n(---)/g)[0].replace(/(---)/g, "") + "}";
    head = JSON.parse(head);
    data = data.replace(/(---)\n.+\n.+\n(---)/g, "");
    var md = marked(data);
    md = '<html><head><title>' + head.name + '</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.3.0/css/font-awesome.min.css"><link rel="stylesheet" href="/assets/stylesheets/style.css"></head><body><div class="crepido"><div class="board"><div class="board__header"><a href="#" class="board__picture"><img src="' + head.picture + '"></a><h3 class="board__name">' + head.name + '</h3></div>' + md + '</div></div></body></html>';
    cache.push({path: reqpath, html: md, time: new Date()});
    response.type('.html');
    response.status(200).send(md);
  });

});

// Convert [ ] and [x] to checkboxes.
function addCheckboxes(string) {
  return string.replace(new RegExp("\\[([\\s|x])\\]", "gi"), function($0, $1) {
    var value = ($1 == 'x') ? 1 : 0;
    return '<input class="status hidden ' + ((value === 1) ? "done" : "") + '" type="checkbox" value="' + value + '" ' + ((value === 1) ? "checked" : "") + ' disabled/>';
  });
}

// Converts [1h], [7h] to timers.
function addTimersDays(string) {
  return string.replace(new RegExp("\\[([0-9]{1,}(.[0-9])?)[d]\\]", "gi"), function($0, $1) {
    return '<span class="timer" data-value="' + $1 + '"><i class="fa fa-clock-o"></i>' + $1 + 'd</span>';
  });
}
function addTimersHours(string) {
  return string.replace(new RegExp("\\[([0-9]{1,}(.[0-9])?)[h]\\]", "gi"), function($0, $1) {
    return '<span class="timer" data-value="' + $1 + '"><i class="fa fa-clock-o"></i>' + $1 + 'h</span>';
  });
}
function addTimersMinutes(string) {
  return string.replace(new RegExp("\\[([0-9]{1,}(.[0-9])?)[m]\\]", "gi"), function($0, $1) {
    return '<span class="timer" data-value="' + $1 + '"><i class="fa fa-clock-o"></i>' + $1 + 'm</span>';
  });
}

// Converts [string] to <span class="label">string</span>.
function labelize(string) {
  return string.replace(new RegExp("\\[([^\\]]*)\\]", "gi"), function($0, $1) {
    var name = $1.toLowerCase().replace(/[^\w]+/g, '-');
    return '<span class="project label label--' + name + '" data-name="' + name + '" data-project="' + $1 + '"><i class="fa fa-folder-o"></i>' + $1 + '</span>';
  });
}

function spanize(string){
  var matches = string.match(/\>(\s+[A-z]{1,})+</g);
  var replacer = [];
  for (var i = 0; i < matches.length; i++) {
    replacer[i] = matches[i].replace("> ", ">&nbsp;<span>").replace(new RegExp("<" + '$'), "</span><");
    string = string.replace(matches[i], replacer[i]);
  }
  return string;
}

app.listen(3000);
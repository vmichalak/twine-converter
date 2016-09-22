var input = "input.html";
var output = "output.db";

var cheerio = require('cheerio');
var fs = require("fs");
var entities = require("entities");
var exists = fs.existsSync(output);

var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(output);

var importTwineFile = function(callback) {
	fs.readFile(input, 'utf8', function (err, html) {
		if (err) { return console.log(err); }
		
		// Datas
		var datas = {};
		datas.nodes = [];
		datas.connections = [];

		// Cheerio Initialization
		var $ = cheerio.load(html);

		// ForEach in all Story Node
		$('tw-passagedata').each(function(index) {
			var key = $(this).attr('name').trim();

			// Content extraction
			var content = $(this).html();
			
			// Connections extraction
			var connections = extractConnections(key, content);
			content = content.replace(/ *\[*\[[^\]]*]*]/, '');

			// Add Node to global datas
			var node = { 'key': key, 'content': content };
			datas.nodes.push(node);
			datas.connections.push.apply(datas.connections, connections);
		});

		callback(datas);
	});
}

var extractConnections = function(from, str) {
	var connections = [];
	var connectionsTemp = str.match(/\[\[(.*?)\]\]/g);

	if(connectionsTemp != null) {
		connectionsTemp.forEach(function(element, index, array) {
			var connectionContent = element.replace('[[', '').replace(']]', '');

			var rel = { 'from': from };

			if(connectionContent.indexOf('-&gt;') > -1) {
				var splitedString = connectionContent.split('-&gt;');
				rel.to = splitedString[1].trim();
				rel.content = splitedString[0].trim();
			}
			else if(connectionContent.indexOf('&lt;-') > -1) {
				var splitedString = connectionContent.split('&lt;-');
				rel.to = splitedString[0].trim();
				rel.content = splitedString[1].trim();
			}
			else {
				rel.to = connectionContent.trim();
				rel.content = rel.to;
			}

			connections.push(rel);
		});
	}

	return (connections);
}

var exportToTaleEngineFile = function(datas) {
	db.serialize(function() {
		// Schema creation
		db.run("CREATE TABLE `StoryNode` (`Key` TEXT NOT NULL UNIQUE, `Content` TEXT, PRIMARY KEY(`Key`));");
		db.run("CREATE TABLE `StoryNodeConnections` ( `From` TEXT NOT NULL, `To` TEXT NOT NULL, `Content` TEXT NOT NULL, FOREIGN KEY(`From`) REFERENCES StoryNode(Key), FOREIGN KEY(`To`) REFERENCES StoryNode(Key));");

		// Insert nodes
		datas.nodes.forEach(function(element, index, array){
			db.run("INSERT INTO `StoryNode` (`Key`, `Content`) VALUES ('" + element.key + "', '" + element.content + "')")
		})

		// Insert connections
		datas.connections.forEach(function(element, index, array){
			db.run("INSERT INTO `StoryNodeConnections` (`From`, `To`, `Content`) VALUES ('" + element.from + "', '" + element.to + "', '" + element.content + "')")
		})
	});
};

importTwineFile(function(datas) {
	console.log(datas);
	exportToTaleEngineFile(datas);
});
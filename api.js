


var views = new DBO.log({table: "views", key: "game_id")});

views.add({game: gameId, ip: ip});









var players = DBO.list(["SELECT * FROM players"], Player);

var armies = DBO.list(["SELECT * FROM armies"], Army);

for(var id in armies) {
	if(armies[id].data.owner == player.data.id) player.armies[id] = armies[id]);
}

armies[name] = DBO.insert("INSERT INTO armies ...", Army);


var player = new Player();

player.data = new DBO.table(["SELECT * FROM players"]);

player.armies = new DBO.list(["SELECT * FROM armies WHERE player_id = ?", player.data.id], Army);

// Set
data.set("name", "Jon Doe");

// Get
console.log(data.name);



var DBO = {};

DBO.table = function(SQL) {
	
	mysql SQL
	
	this[..] = obj[..];
}
DBO.table.prototype.set = function(key, value) {
	this[key] = value;
	
	mysql update ? set key = value WHERE id = this.data.id;
}



DBO.list = function(SQL, Something) {
	mysql SQL
	
	for(var i=0; i<.length; i++) {
		
		this[name] = new Something();
		
		this[name].data = new DBO.table( mysql data)
		
	}
	
}
# DBO: Persistant data abstraction module

## ALERT: This is alpha, wait for >1.0.0 for stable. There might be breaking changes in all 0.x versions


Your DBA guy will be happy you'll be using a SQL relational database, and your JS hackers will be happy about using no-SQL. And you will be happy about getting the advantage of both!

This module for nodejs/iojs makes it easier to manage data and make it persistant between app restarts.

Database selects, updates and inserts will be done automatically! 

An object oriented aproach is not required but recommended.
Constructor functions can be passed and objects will be constructed automatically. Getters and setters work like normal, with the added benefits of the data being persistant and stored in a database, and on a hard drive, but accessed from memory. Data is updated immediately and sent to the database asynchronously in the background.

Note that, in order for this module to work, you must have acccess to a mySQL database and you have to create the datbase schema! This module will not ALTER TABLE or CREATE TABLE.

It (currently) only works with mySQL databases.


Here's a JavaScript example of how you might use this module:
```
var Player = function() {
}
Player.prototype.takeDamage = function(damage) {
	this.data.health -= damage;
};

var Weapon = function() {
}
Weapon.prototype.fireAt(otherPlayer) {
	otherPlayer.takeDamage(this.damage);
}

var DBO = require("DBO");

DBO.connect({host: "127.0.0.1",	user: "nodedeamon", password : "12345", database: "ultrashooter"});


// Load data
var players = new DBO.list({table: "players", fun: Player, key: "name"});
var weapons = new DBO.list({table: "weapons", fun: Weapon, key: "id"});

// Link weapons to the players
players.link({list: weapons, key: "player_name"});

// Update something
players["Arnold"].data.age = 65;

// Insert another player
players.add({name: "Napoleon", age: 45});

// What weapons does Arnold have?
var player = players["Arnold"],
	weapon;
for(var id in player.weapons) {
	weapon = player.weapons[id];
	console.log(weapon.data.name + " with " + weapon.data.damage + " damage");
}

// Fire that weapon
weapon.fireAt(players["Napoleon"]);
```

You only have to remember one function (DBO.list) to make your data persistant.

The "data" will always be under .data, stored as an assosiative array with key, value pairs. We choose to have all "data" under a data attribute to make sure other attributes or functions are not overwritten.

DBO.list can .add, .link and .kill. And it's also a assosiative array with key -value pairs. But with the values being objects constructed by specified function, witch will get data attributes.  

Make sure you use unique identifiers (primary keys) like name, or id (with auto-increment) when you design the database schema!

See the documentation for more info.


<h1>DBO - Abstract the SQL!</h1>

<p>This module for nodejs/iojs makes it easier to manage data and make it persistant between app restarts.</p>

<p>It (currently) needs a mySQL database, that you have to setup yourself.<br>
You also need to make a datbase schema! But you do not have to write SQL withing your app! <br>
Database selects, updates and inserts will be done automatically!<br>
Just use your constructors (functions) and objects normally, with the added benefits of the data being stored in a database (hard drive).</p>

Example:
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

// Load all players
var players = DBO.list("players", Player, "name");

// Load weapons
var weapons = DBO.list("weapons", Weapon, "id");

// Link players to weapons
players.link(weapons, "player_name");

// Update something
players["Arnold"].data.age = 65;

// Insert another player
players.add({name: "Napoleon", age: 45});

// What weapons does Arnold have?
var player = players["Arnold"],
	weapon;
for(var id in Object.keys(player.weapons)) {
	weapon = player.weapons[id];
	
	console.log(weapon.data.name + " with " + weapon.data.damage + " damage");
}

// Fire that weapon
weapon.fireAt(players["Napoleon"]);
```

You only have to remember two objects: DBO.list and DBO.table.

The DBO.table attribute will always be called "data", and is a assosiative array with key, value pairs. We choose to have all "data" under a data attribute to make sure other attributes or functions are not overwritten.

DBO.list can .add, .link and .kill. And is also a assosiative array with key -value pairs. But with the values being objects constructed by specified constructor (function), witch will get a DBO.table data attribute.  


Make sure you use unique identifiers (Primary keys) like name, or id (with auto-increment) when you design the database schema!




## Connect to the database

```
var DBO = require("DBO");

DBO.connect({host: "127.0.0.1",	user: "myuser", password : "mypassword", database: "mydb"});
```


## DBO.list

<b>DBO.list("databaseTable", Constructor, primaryKey, callback)</b>

Creates a list of all the rows in databaseTable. Each row is constructed using Constructor.
If the primaryKey is left out, the id (lower-case) field will be used.

Se example below:

```
var players = DBO.list("tblPlayers", Player, "name", showHighscore);

function showHighscore() {
	for(var name in Object.keys(players)) {

		if(players.hasOwnProperty(name)) {
			console.log(name);
			console.log(players[name].data.score);
		}
	}
}
```
Do not forget .hasOwnProperty() when iterating the list!


### Add to a list (INSERT)

<b>dboList.add(JSON, callback)</b>

Make a INSERT into the database table specified when creating the list. And create a new Object with the constructor specified when making the list.

Example:

```
players.add({name: "Jon Doe", age: 33});
```

Tip: Use default values for most fields in the database!



### Link a list to it's parent, using foreign key (JOIN)

<b>dboList.link(anotherDboList, "foreignKey")</b>

Example:

```
function loadArmies(cb) {
  armies = new DBO.list("tblArmies", Army, "id", cb);
}
function loadPlayers(cb) {
  players = new DBO.list("tblPlayers", Player, "name", cb);
}
loadArmies(loadPlayers(function() {
	players.link(armies)
}
```


### Remove an item in the list (DELETE)

dboList.kill(identifierValue);

Example:
```
players.kill("Jon Doe");
```

Note that you should kill the childs before killing the parent. For example:

```
for(var id in players["Jon Doe"].armies) {
  armies.kill(id);	
}
players.kill("Jon Doe");
```





## DBO.table

<b>DBO.table("databaseTable", "primaryKey", "primaryKeyValue", callback)</b>

Creates a key:value table that holds the row data.

Example:

```
var player = new Player();
player.data = new DBO.table("player", "name", "Johan", doStuff);

function doStuff() {
	player.doSomething();
}

```

### Update the data

Example:
```
player.data.score = player.data.score + 1;
```
 

 
 
 ## Debugging
 ```
 DBO.debug.showSQL = true;
 DBO.debug.showWarnings = true;
 DBO.debug.useColors = true;

 ```

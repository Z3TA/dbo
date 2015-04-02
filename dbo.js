
/*
The MIT License (MIT)

Copyright (c) 2015 Johan Zetterberg (Website: http://joha.nz/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


"use strict";

// Dependencies
var mysql = require("mysql"),
	cli = require("cli-color"),
	deasync = require("deasync");



// Private variables and functions ...

var database,
	db_config = {host: "127.0.0.1",	user: "startupgame", password : "wwwstartupgame", database: "startupgame"},
	dbRetry = 2000,
	listedTables = [],
	debug = {};

debug.warn = function(msg) {
	if(DBO.cfg.debug.showWarnings) {
		debug.log(msg, "yellow");
	}
}
debug.sql = function(sql) {
	if(DBO.cfg.debug.showSQL) {
		debug.log(sql, "cyan");
	}
}
debug.info = function(info) {
	if(DBO.cfg.debug.showInfo) {
		debug.log(info, "white");
	}
}
debug.log = function(msg, color) {
	
	if(!color) {
		throw new Error("No color defined. You probably meant to call debug.info.");
	}
	
	if(DBO.cfg.debug.useColors) {
		console.log(cli[color](msg));
	}
	else {
		console.log(msg);
	}
}

function handleDbDisconnect() {
	
	// Recreate the connection, since the old one cannot be reused.
	database = mysql.createConnection(db_config);
    
	database.connect(function(err) {
		if(err) {
			/* 
				The server is either down or restarting (takes a while sometimes).
				We introduce a delay before attempting to reconnect, to avoid a hot loop, and to allow our node script to process asynchronous requests in the meantime.
				If you're also serving http, display a 503 error.
				Connection to the MySQL server is usually lost due to either server restart, or a connnection idle timeout (the wait_timeout
			*/
			debug.warn("Error when connecting to the database!\n", err, "Trying again in " + dbRetry + "ms ...");
			setTimeout(handleDbDisconnect, dbRetry);
		}
	});

	database.on("error", function(err) {
		if(err.code === "PROTOCOL_CONNECTION_LOST") {
			handleDbDisconnect();
		}
		else {             
			throw new Error("Database error: ", err);
		}
	});
}



// Public objects and functions ...

var DBO = {}; 


DBO.cfg = {};
DBO.cfg.pointToParentInLinks = true;
DBO.cfg.asyncListsCreation = false;
DBO.cfg.checkHasProperty = true; // For optimization if we decide to be evil
DBO.cfg.updateDelay = 1000; // Wait this many ms before pushing updates to the database
DBO.cfg.enableArray = true; // If we should write to the Array.prototype
DBO.cfg.debug = {showSQL: true, showWarnings: true, useColors: true, showInfo: true};


if(Array.prototype.load || Array.prototype.add) {
	DBO.cfg.enableArray = false;
	debug.warn("Array already has prototype that dbo wants to use. DBO.Array will not be supported!" )
}



DBO.connect = function(dbCfg) {

	db_config = dbCfg;
	
	if(database) {
		throw new Error("Already connected to the database!");
	}
	else {
		handleDbDisconnect()
	}
}

DBO.disconnect = function(callback) {
	database.end(function(err) {
		if(callback) callback();
		
		if(err) throw err;

	});
}


DBO.table = function(arg, callback) {
	/*
		The DBO.table holds the *data* object.
	
	*/
	
	var table = this,
		dbTable = arg.table, 
		identifiers = arg.keys;
	
	if(!database) {
		throw new Error("You need to connect to a database! See DBO.connect()");
	}
	else if(!dbTable) {
		throw new Error("No table defined in argument " + JSON.stringify(arg) + "!");
	}
	else if(!identifiers) {
		throw new Error("No key(s) defined in argument " + JSON.stringify(arg) + "!");
	}
	
	
	var query = database.query("SELECT * FROM ?? WHERE ?", [dbTable, identifiers], function(err, rows) {
		if (err) throw new Error(err);

		if(rows.length == 1) {
			
			var data = rows[0];
			
			table.init(data, dbTable, identifiers);

		}
		else {
			throw new Error("Expected one row!");
		}
		
		if(callback) callback();
	});
	
	debug.sql(query.sql);

}



DBO.table.prototype.init = function(data, dbTable, identifiers) {
	var table = this;
	
	if(!dbTable) {
		throw new Error("Table init without dbTable");
	}
	
	if(!identifiers) {
		throw new Error("Table init without identifiers");
	}
	
	Object.defineProperty(table, "__table", { value: dbTable, enumerable: false });
	Object.defineProperty(table, "__identifiers", { value: identifiers, enumerable: false });
	Object.defineProperty(table, "__timers", { value: {}, enumerable: false });

	for(var field in data) {
		table.define(field, data[field]);
		table.__timers[field] = false;
	}
	
	// Object.keys(data).forEach(table.define);
	
}

DBO.table.prototype.define = function (name, currentValue) {
	// Call Object.defineProperty on the attribute to add getter and setter
	
	var table = this,
		dbTable = table.__table,
		identifiers = table.__identifiers,
		where = createWhereString(identifiers);
	
	//table[name] = data[name];
	Object.defineProperty( table, name, {
		get: function(){ return currentValue; },
		set: function(value) {
			
			if(value == undefined) {
				throw new Error("The new value for " + name + " is undefined!");
			}
			else if(value !== value) {
				throw new Error("The new value for " + name + " is NaN!");
			}
			else if(value == null) {
				debug.warn("The new value for " + name + " is null!");
			}
			
			/*
			console.log(JSON.stringify(value) + " = " + value);
			
			console.log("dbTable=" + dbTable);
			console.log("name=" + name);
			console.log("identifiers=" + JSON.stringify(identifiers));
			*/
			
			// Database queries are costly, so check if the value actually updates before updating it.
			if(currentValue != value) {
				
				clearTimeout(table.__timers[name]);
				
				table.__timers[name] = setTimeout(function() {
					
					var query = database.query("UPDATE ?? SET ?? = ? WHERE " + where, [dbTable, name, value, identifiers], function(err, result) {
						if (err) throw new Error(err);
					});
					
					debug.sql(query.sql);
					
				}, DBO.cfg.updateDelay);

			}
			
			currentValue = value;
			
		},
		enumerable: true,
	});
}


DBO.list = function(arg, callback) {

	/*
		
		Creates a list of something, initiates and gives each item its data ...
		
		Each list item can only have one primary key (identifier) witch will be used to access the item as this is an associative array.
		
	*/
	
	var list = this,
		data,
		dbTable = arg.table,
		constructor = arg.fun,
		identifier = arg.key,
		done = false;
		
	Object.defineProperty(list, "__table", { value: dbTable, enumerable: false });
	Object.defineProperty(list, "__constructor", { value: constructor, enumerable: false });
	Object.defineProperty(list, "__identifier", { value: identifier, enumerable: false });
	Object.defineProperty(list, "__links", { value: [], enumerable: false });
	
	if(dbTable === false) {
		debug.warn("No database will be used for persistant storage!");
		return;
	}
	else if(!database) {
		throw new Error("You need to connect to a database! See DBO.connect()");
	}
	else if(!dbTable) {
		throw new Error("No database table specified!");
	}
	else if(DBO.cfg.asyncListsCreation === false && callback) {
		throw new Error("Can not have a callback when DBO.cfg.asyncListsCreation is set to false!");
	}
	
	if(!identifier) {
		identifier = "id";
	}
	
	if(listedTables.indexOf(dbTable) > -1) {
		throw new Error("Table " + dbTable + " already linked!"); 
	}
	else {
		listedTables.push(dbTable);
	}
	
	var query = database.query("SELECT * FROM ??", [dbTable], function(err, rows) {
		if (err) throw new Error(err);
		var counter = 0;
		
		for(var i=0; i<rows.length; i++) {
			
			fillData(rows[i])

			
		}
		
		done = true;
		
		if(callback && DBO.cfg.asyncListsCreation) callback();
		
		
	});
	debug.sql(query.sql);
	



	if(DBO.cfg.asyncListsCreation === false) {
		while(!done) {
			deasync.runLoopOnce();
		}
		
		if(callback) callback();
	}

	function fillData(row) {

		var name = row[identifier];
		
		if(!name) {
			throw new Error("No identifier (" + identifier + ") exist in " + dbTable + ". Please use one field as a primary key!");
		}
		
		var objData = Object.create(DBO.table.prototype); // We use Object.create here because we don't want to call the actual function. That would result in another database SELECT.
		
		var table_identifiers = {};
		table_identifiers[identifier] = row[identifier];
		
		objData.init(row, dbTable, table_identifiers);
		//objData.init(row, dbTable, identifier, name);
		
		
		if(constructor) {
			list[name] = new constructor(objData); // Important we use new here so that the object function is called.
		}
		else {
			list[name] = {};
		}
		
		list[name].data = objData;

		
		Object.defineProperty(list[name].data, "__identifier", { value: identifier, enumerable: false });
		Object.defineProperty(list[name].data, "__identifierValue", { value: row[identifier], enumerable: false });
		
	}
	
	
}


DBO.list.prototype.add = function(values, callback) {
	var list = this,
		object,
		objectData,
		dbTable = list.__table,
		identifier = list.__identifier,
		identifierValue,
		async = (callback === false) ? false : true;
	


		
	/* We can be sure that identifier has been defined and exists! Or DBO.list would have thrown an error when doing the database SELECT.
	   But if the identifier is not in the values, we have to wait for last inserted id before creating the new list object!
	*/
	
	if(values.hasOwnProperty(identifier)) {
		identifierValue = values[identifier];
		
		// Check for dublicate keys and throw an error if we find any
		if(list[identifierValue]) {
			throw new Error(identifier + " " + identifierValue + " already exist in the " + dbTable + "-list! " + identifier + " must be unique!");
		}
		
	}
	
	if(dbTable) {
		var query = database.query("INSERT INTO ?? SET ?", [dbTable, values], function(err, result) {
			if (err) throw new Error(err);
			
			if(!identifierValue) {
				identifierValue = result.insertId;
			}
			
			// We now got the identifierValue but have to wait for the data before inserting the new objec to the list ...
			
			var table_identifiers = {};
			table_identifiers[identifier] = identifierValue;
			
			// Make a SELECT to get All fields
			objectData = new DBO.table({table: dbTable, keys: table_identifiers}, init);
			
		});
		debug.sql(query.sql);
	}
	else {
		
		// OFFLINE MODE
		debug.warn("The data added will not be stored in the database!");
		
		objectData = values;

		init();
		
	}
	
	function init() {
	
		// We should now have all the data available!
	
		if(list.__constructor) {
			object = new list.__constructor(objectData); // We use new here so that the object function is called
		}
		else {
			object = {}; // New vanilla object
		}
		
		object.data = objectData;
	
		// Insert the new object to the list
		list[identifierValue] = object; 
	
		updateLinks();
		
		if(callback) callback(object);
	
	}
	
	
	
	function updateLinks() {
		// Keep the links up to date with the added object ...

		for(var i=0, link; i<list.__links.length; i++) {
			link = list.__links[i];
			
			updateLink(link);
			
		}
		
		function updateLink(link) {
			var parentList = link.list,
				key = link.key,
				attribute = link.attribute,
				keyValue = object.data[key];
			
			for(var index in parentList) {
				if(parentList.hasOwnProperty(index)) {
					if(index == keyValue) { // if player.name = army.owner
					
						// Link the new object
						parentList[index][attribute][identifierValue] = object;
					}
				}
			}
			
		}
	}
	
}


DBO.list.prototype.link = function(arg) {

	// {list: shares, key: "player", attribute: "shareholders"}

	var list = this,
		identifier = list.__identifier,
		otherList = arg.list,
		key = arg.key || list.__table,
		attribute = arg.attribute || otherList.__table,
		parentName = (typeof arg.pp === "string") ? arg.pp : key,
		pointToParent = (arg.pp == undefined) ? DBO.cfg.pointToParentInLinks : arg.pp;
	
	for(var i=0, link; i<otherList.__links.length; i++) {
		link = otherList.__links[i];
		
		// Check if there's already a link between the two lists using key
		if(link.list == list && link.key == key) {
			throw new Error("The two lists are already linked using " + key + " as " + link.attribute + "!");
		}
	}


	otherList.__links.push({key: key, list: list, attribute: attribute});

	
	for(var index in list) {
		if(list.hasOwnProperty(index)) {
			makeAttributeLinkFor(index);			
		}
	}
	
	function makeAttributeLinkFor(objectIndex) {
		
		var listObject = list[objectIndex],
			identifierValue = listObject.data[identifier];
		
		if(listObject[attribute]) {
			throw new Error(attribute + " in "  + objectIndex + " was going to be overwritten ... You probably don't want that, or there is a bug!");
		}
		else {
			listObject[attribute] = Object.create(DBO.list.prototype);
		}
		
		
		for(var index in otherList) {
			if( otherList.hasOwnProperty(index) ) {
				
				if(!otherList[index].data.hasOwnProperty(key)) {
					throw new Error(index + " does not have the key/attribute: " + key + "!");
				}
				
				if(otherList[index].data[key] == identifierValue) {
				
					listObject[attribute][index] = otherList[index];
					
					
					if(pointToParent) {
						// Also make a pointer at the parent for easy access
						if(otherList[index][parentName]) {
							debug.warn("Key " + parentName + " in " + otherList.__table + " "  + index + " already exist!\n ... You might want to call DBO.link with pp: false or set DBO.cfg.pointToParentInLinks = false");
						}
						else {
							otherList[index][parentName] = listObject;
						}
					}
					
					
					
					
				}
			
			}
		}
		
		if(DBO.crazyJoin) {
			// Also make like a INNER JOIN
		}
		
	}

}



DBO.list.prototype.kill = function(keyValue) {

	var list = this
		dbTable = list__table,
		key = list__identifier;
	
	delete list[keyValue];
	
	var query = database.query("DELETE FROM ?? WHERE ?? = ?", [dbTable, key, keyValue], function(err, result) {
		if (err) throw new Error(err);
	});
	
	debug.sql(query.sql);
	
	/*
	
	Javascript is smart, so we don't have to do this:
	
	// Traverse all links and remove this object
	for(var i=0, link, attribute, parentList; i<list.__links.length; i++) {
		link = list.__links[i];
		attribute = link.attribute;
		parentList = link.list;
		
		delete parentList[attribute][keyValue];
		
	}
	
	*/
	
}

DBO.list.prototype.rand = function() {
	// Return a random object from the list
	
	var list = this,
		keys = Object.keys(list),
		key = keys[Math.floor(Math.random()*keys.length)];
	
	return list[key];	
}

DBO.list.prototype.first = function() {
	var list = this,
		keys = Object.keys(list);
	
	/*
		You should never make assumptions about the order of elements in a JavaScript object.
		
	*/
	
	if(keys.length > 1) {
		throw new Error("List contains more then one object. Consider using .rand() instead of .first()")
	}
	else if(keys.length == 0) {
		return false;
	}
	
	for (var first in list) return list[first];
}



DBO.list.prototype.search = function(keyValues) {
	/*
	
		Works like AND ... AND ...
	
	*/
	var list = this,
		identifier = list.__identifier,
		identifierValue,
		foundObjects = Object.create(DBO.list.prototype),
		allMatch = true,
		keys,
		obj;
	
	if(!keyValues) return list;
	
	if(keyValues.hasOwnProperty(identifier)) {
		// Take a shortcut, search only one object
		
		identifierValue = keyValues[identifier];
		
		if(list.hasOwnProperty(identifierValue)) {
			
			allMatch = true;
			
			for(var key in keyValues) {
				if(list[identifierValue].data[key] != keyValues[key]) {
					allMatch = false;
					break;
				}
			}
			
			if(allMatch) {
				foundObjects[identifierValue] = list[identifierValue];
			}
			
		}

	}
	else {
		// Search all objects (we might be able to optimize this code ...)
		
		keys = Object.keys(list);
		
		for(var i=0; i<keys.length; i++) {

			obj = keys[i];
			
			allMatch = true;
			
			for(var key in keyValues) {
				if(list[obj]["data"][key] != keyValues[key]) {
					allMatch = false;
					break;
				}
			}
			
			if(allMatch) {
				foundObjects[obj] = list[obj];
			}
		}
	}
	
	return foundObjects;
}

DBO.list.prototype.count = function(keyValues) {

	/*
	
		We might be able to optimize this by caching!?
	
	*/

	var list = this;
	
	if(keyValues) {
		list = list.search(keyValues);
	}
	
	return Object.keys(list).length;

}


DBO.list.prototype.sum = function(key) {
	// Takes any object, a list or the return from list.search and count a field with float type
	var sum = 0,
		list = this;
	
	for(var id in list) {
		sum += list[id].data[key];
	}
	
	return sum;
}



DBO.list.prototype.find = function(keyValues) {
	
	/*
	
		An idea ... We could pass a function as argument. And items are added if the function returns true
		
		mylist.find(searchFunction);
		
		function searchFunction(table) {
			if(table.data.a > 1) return true;
		}
	
	
		Works like OR ... OR ...
	
	*/
	
	var list = this,
		matchingObjects = Object.create(DBO.list.prototype),
		item,
		comparator = "",
		compareValue,
		value;

	for(var id in list) {
		item = list[id];
		for(var key in keyValues) {
			
			value = item.data[key];
			
			if(typeof keyValues[key] === "array") {
				comparator = keyValues[key][0];
				compareValue = keyValues[key][1];
				
				switch(comparator) {
					
					case "gt": if(value > compareValue) matchingObjects[id] = item;					break; // Greater
					case "eq": if(value == compareValue) matchingObjects[id] = item;				break; // Equal
					case "ls": if(value < compareValue) matchingObjects[id] = item;					break; // Less
					case "nt": if(value != compareValue) matchingObjects[id] = item;				break; // Not
					case "ct": if(value.indexOf(compareValue) > -1) matchingObjects[id] = item;		break; // Contains
					
				}
			}
			else { // Only return items that are equal
			
				compareValue = keyValues[key];
				
				if(value == compareValue) {
					matchingObjects[id] = item;
				}
			}
			


		}
	}

	return matchingObjects;
}

DBO.list.prototype.filter = function(fun) {
	/*
	
	Filter a list using a function that returns true or false
	
	*/
	var list = this,
		keys = Object.keys(list),
		filtredList = Object.create(DBO.list.prototype);
		
	for(var i=0; i<keys.length; i++) {
		check(keys[i]);
	}

	function check(key) {
		if(fun(list[key].data)) filtredList[key] = list[key];
	}
	
	return filtredList;
}



DBO.list.prototype.shuffledKeys = function() {
	var list = this,
		keys = Object.keys(list);
		

	keys = shuffleArray(keys);

	return keys;
		

	function shuffleArray(array) {
		// Fisher-Yates shuffle: Randomize array element order in-place.
		for (var i = array.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
		return array;
	}
		
}


DBO.list.prototype.sortedKeys = function(sortBy) {
	var list = this,
		keys = Object.keys(list),
		keysSorted = keys.sort(sortFunction);

	/*
		Should we clone the list or have the original sorted?
		You should never make assumptions about the order of elements in a JavaScript object.

	
	for(var i=0, i<keysSorted.length; i++) {
		keysSorted[i] = list[keysSorted[i]];
	}
	*/
	return keysSorted;
	
	
	function sortFunction(objKeyA, objKeyB) {
		
		var valueA,
			valueB,
			result = 0,
			sortMethod;
			
		
		// todo: able to pass array and only use ASC
		
		for(var key in sortBy) {
			
			valueA = objA.data[key];
			valueB = objB.data[key];
			
			sortMethod = sortBy[key];
			
			// if(typeof valueA == "string") // WOW JS can compare strings automagically
			
			if(sortMethod == "DESC") { // Highest first
				if(valueA > valueB) {
					result = 1;
				}
				else if(valueA < valueB) {
					result = -1;
				}
			}
			else { // ASC, Lowest first
				if(valueA > valueB) {
					result = -1;
				}
				else if(valueA < valueB) {
					result = 1;
				}
			}
			
			if(result) break; 
				
			// If result == 0, check next sort key
		
		}
		
		//return list[a]-list[b]
		
		return result;

	}
	
	
	// BRainfuckk
	function dynamicSortMultiple() {
		/*
		 * save the arguments object as it will be overwritten
		 * note that arguments object is an array-like object
		 * consisting of the names of the properties to sort by
		 */
		var props = arguments;
		return function (obj1, obj2) {
			var i = 0, result = 0, numberOfProperties = props.length;
			/* try getting a different result from 0 (equal)
			 * as long as we have extra properties to compare
			 */
			while(result === 0 && i < numberOfProperties) {
				result = dynamicSort(props[i])(obj1, obj2);
				i++;
			}
			return result;
		}
	}
	
}

// Hide the List.prototypes from enumerable
Object.defineProperty(DBO.list.prototype, "add", {enumerable: false, value: DBO.list.prototype.add});
Object.defineProperty(DBO.list.prototype, "link", {enumerable: false, value: DBO.list.prototype.link});
Object.defineProperty(DBO.list.prototype, "kill", {enumerable: false, value: DBO.list.prototype.kill});
Object.defineProperty(DBO.list.prototype, "rand", {enumerable: false, value: DBO.list.prototype.rand});
Object.defineProperty(DBO.list.prototype, "first", {enumerable: false, value: DBO.list.prototype.first});
Object.defineProperty(DBO.list.prototype, "search", {enumerable: false, value: DBO.list.prototype.search});
Object.defineProperty(DBO.list.prototype, "count", {enumerable: false, value: DBO.list.prototype.count});
Object.defineProperty(DBO.list.prototype, "sum", {enumerable: false, value: DBO.list.prototype.sum});
Object.defineProperty(DBO.list.prototype, "find", {enumerable: false, value: DBO.list.prototype.find});
Object.defineProperty(DBO.list.prototype, "filter", {enumerable: false, value: DBO.list.prototype.filter});
Object.defineProperty(DBO.list.prototype, "shuffledKeys", {enumerable: false, value: DBO.list.prototype.shuffledKeys});
Object.defineProperty(DBO.list.prototype, "sortedKeys", {enumerable: false, value: DBO.list.prototype.sortedKeys});




DBO.log = function(arg, callback) {
	
	/*
		
		todo: all keys get their own property
		
		every key has to have a combo
		
		log.publisher = {advertiser: {publisher, ip}, ip: {advertiser, publisher}}
		log.advertiser = {publisher: {}, ip: {}}
		log.ip = {publisher: {}, advertiser: {}}
	
		l.count({publisher: publisher, advertiser: advertiser, ip: ip});
		
		l.count({advertiser: advertiser});
		
		
	*/
	
	var typeofKeys = Object.prototype.toString.call( arg.keys );

	if(typeofKeys !== "[object Array]") {
		throw new Error("keys must be an array with at least one item! You passed a " + typeofKeys + "");
	}

	var log = this,
		dbTable = arg.table,
		keys = arg.keys,
		async = (callback === false) ? false : true,
		done = false,
		recursiveCount = 0,
		recursiveDone = keys.length;
		
	Object.defineProperty(log, "__table", { value: dbTable, enumerable: false });
	Object.defineProperty(log, "__keys", { value: keys, enumerable: false });
		
	if(dbTable === false) {
		debug.warn("No database will be used for persistant storage!");
		return;
	}
	else if(!database) {
		throw new Error("You need to connect to a database! See DBO.connect()");
	}
	else if(!dbTable) {
		throw new Error("No database table specified!");
	}

	if(listedTables.indexOf(dbTable) > -1) {
		throw new Error("Table " + dbTable + " already linked!"); 
	}
	else {
		listedTables.push(dbTable);
	}
	
	
	recurse(log, keys, {});
	
	
	function recurse(obj, keys, parents) {
		
		//console.log("Recursing!");
		
		for(var i=0, k; i<keys.length; i++) {
			
			k = keys.slice(); // Copy array
			
			k.splice(i, 1); // Remove item from array copy
			
			getCount(obj, keys[i], k, parents);
			
		}
	}
	
	
	function getCount(obj, key, keys, parents) {
	
		var SQL,
			parentKeys = Object.keys(parents),
			query;
		
		if(parentKeys.length === 0) {
			query = database.query("SELECT ??, Count(*) AS entries FROM ?? GROUP BY ??", [key, dbTable, key], queryCallback);
		}
		else {
		
			SQL = "SELECT `" + key + "` AS `" + key + "`, ";
			for(var i=0; i<parentKeys.length; i++) {
				SQL += "`" + parentKeys[i] + "` AS '" + parentKeys[i] + "', ";
			}
			
			SQL += "Count(*) AS entries FROM `" + dbTable + "` GROUP BY "

			for(var i=0; i<parentKeys.length; i++) {
				SQL += "`" + parentKeys[i] + "`, ";
			}

			SQL += "`" + key + "`";
			
			SQL += " HAVING "
			for(var i=0; i<parentKeys.length; i++) {
				SQL += "`" + parentKeys[i] + "` = '" + parents[parentKeys[i]] + "' AND ";
			}
			
			SQL = SQL.substring(0, SQL.length - 5); // Remove last AND
		
			query = database.query(SQL, [dbTable], queryCallback);
		}
		
		//console.log("key=" + key + " keys:" + keys + " parents:" + JSON.stringify(parents));
		
		debug.sql(query.sql);
		
		
		function queryCallback(err, rows) {
		
			if (err) throw new Error(err);
			
			//console.log(JSON.stringify(rows));
			
			if(rows.length === 0) {
				obj[key] = obj.__total;
				
				//console.log("Query had no result ... Setting " + key + " to " + obj.__total);
				
			}
			else {
			
				obj[key] = {};
				
				for(var i=0, data, name, newParents; i<rows.length; i++) {
					
					data = rows[i];
					
					name = data[key];
					
					if(keys.length > 0) {
					
						
						// again ...
						
						//console.log("oldParents=" + JSON.stringify(parents));
						
						newParents = clone(parents);
						
						newParents[key] = name; // Add current key
						
						//console.log("newParents=" + JSON.stringify(newParents));

						//console.log("err key=" + key + " keys=" + JSON.stringify(keys));
						
						obj[key][name] = {};
						
						Object.defineProperty(obj[key][name], "__total", { value: data.entries, enumerable: false, writable: true });

						recurse(obj[key][name], keys, newParents);
						
						
					}
					else {
						// We have reached bedrock
						obj[key][name] = data.entries;

					}
					
					
				}
			}
			
			if(recursiveCount++ == recursiveDone) {
				//console.log("ALL DONE!");
				done = true;
			}
			
		
		}

	
	}
	
	

	

	function fill(name, key) {
	
		// SELECT publisher, advertiser, Count(*) AS entries FROM views GROUP BY advertiser HAVING publisher = 100;
		// If we had used a DBO.list we could have crunshed this, but as we are only storing Count(*)'s we have to make another db query
		
		log[name][key] = {}; // log["publisher1"].advertiser = {}
		
		var query = database.query("SELECT ?? AS id, ?? AS keyy, Count(*) AS entries FROM ?? GROUP BY ?? HAVING ?? = ?", [identifier, key, dbTable, key, identifier, name], function(err, rows) {
			if (err) throw new Error(err);

			for(var i=0; i<rows.length; i++) {
				
				log[name][key][rows[i].keyy] = rows[i].entries;
				
			}
			
			if(fillCount++ == fillGoal) {
				done = true;
				
				if(callback) callback();
			}
		});
		debug.sql(query.sql);

	}
	
}

DBO.log.prototype.add = function(values, callback) {
	var log = this,
		dbTable = log.__table,
		keys = log.__keys,
		done = false,
		async = (callback === false) ? false : true;
	
	
	for(var i=0, k; i<keys.length; i++) {
		if(!values.hasOwnProperty(keys[i])) {
			throw new Error("Data entry must have a " + keys[i] + "!\n" + JSON.stringify(values, null, 2));
		}
	}
	
	/*
		Increment for all key combos ...
	
		{
			"publisher": {
				"100": {
					"advertiser": {
						"101": 2
					}
				}
			},
			"advertiser": {
				"101": {
					"publisher": {
						"100": 2
					}
				}
			}
		}
		
		new entry: values = {publisher: 100, advertiser: 101, ip: "127.0.0.1"}
		
		log["publisher"] [values[publisher]] ["advertiser"] [values[advertiser]] ++
		
		log["advertiser"] [values[advertiser]] ["publisher"] [values[publisher]] ++

		
	*/
	

	recurse(log, keys);
	
	//console.log(JSON.stringify(log, null, 4));
	
	function recurse(tree, keys) {
		// Loop keys and dig deeper ...
		for(var i=0, keys_copy, newTree, value; i<keys.length; i++) {
		
			// Make a new array with the current keys[i] value left out
			keys_copy = keys.slice(); // Copy array
			keys_copy.splice(i, 1); // Remove item from array copy
			
			setCount(tree, keys[i], keys_copy);

		}
	}
	
	
	function setCount(tree, key, keys) {

		var value = values[key];
		
		if(!tree.hasOwnProperty(key)) {
			tree[key] = {};
		}
		
		tree = tree[key];
		
		if(keys.length == 0) {
			// We reached bedrock! Increment the counter
			
			if(tree.hasOwnProperty(value)) {
				tree[value]++;
			}
			else {
				tree[value] = 1;
			}
			
			//console.log(value + "=" + tree[value]);
			
		}
		else {
		
			if(!tree.hasOwnProperty(value)) {
				tree[value] = {};
				tree[value].__total = 0;
			}
			
			tree[value].__total++;
			recurse(tree[value], keys);
		}

	}
	
	if(dbTable) {
		var query = database.query("INSERT INTO ?? SET ?", [dbTable, values], function(err, result) {
			if (err) throw new Error(err);
			
			done = true;
			
			if(callback) callback();
		});
		debug.sql(query.sql);
	}
	else {
		
		// "Offline mode"
		
		debug.warn("Entry not saved to database!");
		done = true;
		
		if(callback) callback();
	}
	
}

DBO.log.prototype.count = function(keyValues) {
	var log = this,
		keys = log.__keys,
		value,
		tree = log;
	
	
	for(var key in keyValues) {
		if(keys.indexOf(key) == -1) {
			throw new Error(key + " is not defined as a key. Only " + JSON.stringify(keys) + " can be used for counting!");
		}
		
		if(tree.hasOwnProperty(key)) {
			tree = tree[key];
			
			value = keyValues[key];
			
			if(tree.hasOwnProperty(value)) {
				tree = tree[value];
			}
			else {
				debug.warn(value + " does not exist in " + key + "!");
				return 0;
			}

		}
		else {
			debug.warn(key + " is empty!");
			return 0;
		}

	}
	
	if(typeof tree === "number") {
		return tree;
	}
	else {
		return tree.__total;
	}
	
}

DBO.log.prototype.list = function(keyValues, anyKey) {
	var log = this,
		keys = log.__keys,
		value,
		tree = log;

	
	/* Make sure all keys exist in keyValues
	for(var key in keys) {
		if(!keyValues.hasOwnProperty(key)) {
			throw new Error('Argument does not contain key ' + key + '. Pass ' + key + ':"*" to list all ' + key + '.'); 
		}
	}
	*/
	
	for(var key in keyValues) {
		if(keys.indexOf(key) == -1) {
			throw new Error(key + " is not defined as a key. Only " + JSON.stringify(keys) + " can be used to create a list!");
		}
		
		
		if(tree.hasOwnProperty(key)) {
			tree = tree[key];
			
			value = keyValues[key];
		
			if(tree.hasOwnProperty(value)) {
				tree = tree[value];
			}
			else {
				debug.warn(value + " does not exist in " + key + "!");
				return {};
			}

		}
		else {
			debug.warn(key + " is empty!");
			return {};
		}

	}
	
	if(anyKey) {
		if(tree.hasOwnProperty(anyKey)) {
			return tree[anyKey];
		}
		else {
			debug.warn(value + " does not exist in " + JSON.stringify(tree) + "!");
			return {};
		}
	}
	
	return tree;

}


if(DBO.cfg.enableArray) {
	/*
		JavaScript does not support making custom Array objects. 
		So we have to use native Arrays if we want to take advantage of how they operate.
		http://perfectionkills.com/how-ecmascript-5-still-does-not-allow-to-subclass-an-array/
	*/
	DBO.Array = Array;

	DBO.Array.prototype.load = function(arg, callback) {
		/*
			Array with multi dimensions containing a DBO.table for each row. 
			
			Will run Async if callback function is defined.
			
			Use for tables that have many primary keys witch all are integers.
			
			If dimension key is larger then 4,294,967,295 (2^32) it might no longer be an Array
			
		*/
		
		if(!arg.dimensions) {
			throw new Error("Array need to have at least one dimension. For example the primary key.")
		}
		
		var array = this,
			dbTable = arg.table,
			dimensions = arg.dimensions,
			constructor = arg.fun,
			identifier = dimensions[0], // First dimension
			totalDimensions = dimensions.length,
			done = false;

		
		Object.defineProperty(array, "__dimensions", { value: dimensions, enumerable: false });
		Object.defineProperty(array, "__table", { value: dbTable, enumerable: false });
		Object.defineProperty(array, "__constructor", { value: constructor, enumerable: false });

		
		var query = database.query("SELECT * FROM ?? ORDER BY ?", [dbTable, dimensions], function(err, rows) {
			if (err) throw new Error(err);
			
			for(var i=0; i<rows.length; i++) {
				array.fillData(rows[i]);
			}
			
			debug.info("Got " + rows.length + " rows from " + dbTable);
			
			done = true;
			
			if(callback) callback(array);
			
			

			
		});
		debug.sql(query.sql);
		
		if(!callback) {
			while(!done) {
				deasync.runLoopOnce();
			}
			
			return array;
		}
		
	}

	
	DBO.Array.prototype.fillData = function(keyValues) {

		var array = this,
			dbTable = array.__table,
			dimensions = array.__dimensions,
			totalDimensions = dimensions.length,
			constructor = array.__constructor,
			dimensionValue = [],
			table_identifiers = {},
			arrayObject,
			dataTable = Object.create(DBO.table.prototype),
			datarow = clone(keyValues);
			
		// Get dimension values
		for(var i=0; i<dimensions.length; i++) {
			// Do we need to do this for every row??
			if(!datarow.hasOwnProperty(dimensions[i])) {
				throw new Error("Can not find " + dimensions[i] + " in table " + dbTable);
			}
			dimensionValue[i] = datarow[dimensions[i]];
			
			table_identifiers[dimensions[i]] = dimensionValue[i];
			
			debug.info("dimensionValue[" + i + "]=" + dimensionValue[i] + " (" + dimensions[i] + ")")
			
			delete datarow[dimensions[i]]; // Remove the dimensions from the actual data (or should we?)
		}

		
		dataTable.init(datarow, dbTable, table_identifiers); // Set the data

		/*
			array[d1][d2][d3]...
		
			How can we do this without if's !??? if(totalDimensions == 1) else if(totalDimensions == 2) etc
		*/
		if(totalDimensions == 1) {
			if(constructor) {
				array[ dimensionValue[0] ] = new constructor(dataTable);
			}
			else {
				array[ dimensionValue[0] ] = {}; // Vanilla object
			}
			array[ dimensionValue[0] ].data = dataTable;
		}
		else if(totalDimensions == 2) {
			
			if(!array[dimensionValue[0]]) {
				// No other dimension exist, create one
				array[dimensionValue[0]] = [];
				
				//array[dimensionValue[0]].push([]);
			}
			
			/*
			if(array[dimensionValue[0]].length-1 != dimensionValue[0]) {
				throw new Error("The Array is not in order or has empty spaces: " + (array[dimensionValue[0]].length-1) + " (array[dimensionValue[0]].length-1) != " + dimensionValue[0] + " (" + dimensions[0] + ")")
			}
			*/
			
			//console.log("array[" + dimensionValue[0] + "][" + dimensionValue[1] + "]");

			if(constructor) {
				array[dimensionValue[0]][dimensionValue[1]] = new constructor(dataTable);
			}
			else {
				array[dimensionValue[0]][dimensionValue[1]] = {}; // Vanilla object
			}
			
			array[dimensionValue[0]][dimensionValue[1]].data = dataTable;

		}
		
	}
	
	

	DBO.Array.prototype.add = function(keyValues, callback) {
		/*
			Add values to an Array. 
			
			keyValues should contain ALL data. Do not depend on database default fields. 
		*/

		var array = this,
			dbTable = array.__table,
			dimensions = array.__dimensions,
			async = (callback === false) ? false : true,
			totalDimensions = dimensions.length,
			table_identifiers = {};
		
		// Check if keyValues contains dimensions
		for(var i=0; i<totalDimensions; i++) {
			if(!keyValues.hasOwnProperty(dimensions[i])) {
				throw new Error("Data added to the Array do not contain a value for dimension " + i + ": " + dimensions[i] + "!");
			}
			table_identifiers[dimensions[i]] = keyValues[dimensions[i]];
		}
		
		// Check if the index(es) already exist: Then update the data and exit
		if(totalDimensions == 1) {
			if(array[keyValues[dimensions[0]]]) {
				for(var key in keyValues) {
					array[keyValues[dimensions[0]]].data[key] = keyValues[key];
				}
				return;
			}
		}
		else if(totalDimensions == 2) {
			if(array[keyValues[dimensions[0]]]) { // First dimension exist
				
				if(array[keyValues[dimensions[0]]][keyValues[dimensions[1]]]) { // First and second dimension exist
					
					debug.info("" + dimensions[0] + "=" + keyValues[dimensions[0]] + " " + dimensions[1] + "=" + keyValues[dimensions[1]] + " .data=" + array[keyValues[dimensions[0]]][keyValues[dimensions[1]]].data);
					
					for(var key in keyValues) {
						array[keyValues[dimensions[0]]][keyValues[dimensions[1]]].data[key] = keyValues[key];
					}
					return;
				}
			}
		}
		

		array.fillData(keyValues);
		
		
		var query = database.query("INSERT INTO ?? SET ?", [dbTable, keyValues], function(err, result) {
			if (err) throw new Error(err);

			if(callback) {
				callback();
				//callback(array[keyValues[dimensions[0]]][keyValues[dimensions[1]]]);
			
			}
		});
		debug.sql(query.sql);
		
	}
}



module.exports = DBO;





/*

Notes:

package.json needs to be saved in utf8 without BOM.


*/



function createWhereString(keyValues) {
	// WHERE a = 1 AND b = 2 AND c = 3
	
	var keys = Object.keys(keyValues);
	
	keys = keys.map(function (key) {
		return "`" + key + "`='" + keyValues[key] + "'";
	});
	
	return keys.join(" AND ");
}


function clone(obj) {
    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}
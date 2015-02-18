
var fruits = ["Banana", "Orange", "Lemon", "Apple", "Mango"];

for(var i=0, n; i<fruits.length; i++) {
	
	n = fruits.slice();
	
	n.splice(i, 1);
	
	console.log("fruits=" + fruits);

	yo(fruits[i], n);
}

console.log("fruits=" + fruits);


function yo(a, b) {
	console.log(a + " not in " + b);
}

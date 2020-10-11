uri = "http://www.w3.org/2000/svg";
c_white		= "#FFFFFF";
c_lightgrey	= "#CCCCCC";
c_darkgrey	= "#444444";
c_black		= "#000000";
c_array		= [c_black, c_darkgrey, c_lightgrey, c_white];

// returns the hexadecimal representation of a number in at least two characters
// in the context of this tool, number should always be between #00 and #FF so no check is performed
function hexify(number) {
	var s = number.toString(16);
	if (s.length == 1)
		return "0"+s;
	return s;
}

// represents a GameBoy Sprite : height and width should be multiples of 8
// svg_element is the svg NS element in the html page
// stores data in an array
class GBSprite {
	constructor(svg_element, width, height) {
		this.svg = svg_element;
		this.width = width;
		this.height = height;
		this.generate_grid();
	}
	// creates a grid of specified dimensions filled with color 0 (black) and the svg visualisation
	generate_grid() {
		var viewbox = "0 0 " + this.width + " " + this.height;
		this.svg.setAttribute("viewBox", viewbox);

		this.array = new Array(this.height);
		
		for (var y = 0 ; y < this.height ; y++)
		{
			var g_line = document.createElementNS(uri, 'g');
			g_line.setAttribute("id", "line"+y);
			g_line.setAttribute("transform", "translate(0,"+y+")");

			this.array[y] = new Array(this.width);
			for (var x = 0 ; x < this.width ; x++)
			{
				var pixel = document.createElementNS(uri, 'rect');
				pixel.setAttribute("id",x);
				pixel.setAttribute("x", x);
				pixel.setAttribute("width",1);
				pixel.setAttribute("height",1);
				pixel.setAttribute("fill", c_array[0]);
				this.array[y][x] = 0;
				g_line.appendChild(pixel);
			}
			this.svg.appendChild(g_line);
		}
	}
	// refills the svg cells with the content of c_array, usefull when the color palette changes
	update_grid() {
		for (var y = 0 ; y < this.height ; y++)
		{
			var g_line = this.svg.getElementById("line"+y);
			for (var x = 0 ; x < this.width ; x++)
			{
				var pixel = g_line.childNodes[x];
				pixel.setAttribute("fill", c_array[this.array[y][x]]);
			}
		}
	}
	// change value of specified cell
	// x and y must be in respectively 0..with-1 and 0..height-1
	// value must be in 0..3
	setCellValue(x,y,value)
	{
		if (value < 0 || value > 3)
			return;

		var g_line = this.svg.getElementById("line"+y);
		if (g_line === null)
			return;
		var cell = g_line.childNodes[x];
		if (cell === null)
			return;

		this.array[y][x] = value;
		cell.setAttribute("fill", c_array[value]);
	}
	// returns a string containing the image data in the gameboy tile format :
	// each two bytes represents a line from top to bottom
	// each first (resp. second) byte is the strong (resp. weak) bits of the line's pixels from left to write
	// Example : deaf cafe represents two lines : 32123331 and 33113130
	translate_to_hex(put_space=true)
	{
		var hexstring = "";
		for (var j = 0 ; j < this.height / 8 ; j++)
		{
			for (var i = 0 ; i < this.width / 8 ; i++)
			{
				for (var y = 0 ; y < 8 ; y++)
				{
					var hexweak = 0;
					var hexstrong = 0;
					for (var x = 0 ; x < 8 ; x++)
					{
						hexweak += (this.array[j*8+y][i*8+x]&1)<<(7-x);
						hexstrong += ((this.array[j*8+y][i*8+x]&2)>>1)<<(7-x);
					}
					hexstring += hexify(hexstrong) + hexify(hexweak);
					if (put_space)
						hexstring += ' ';
				}
			}
		}
		return hexstring.trimEnd(1);
	}
	generate_download_link(link_element) {
		// get image data in hex form
		var hexstring = this.translate_to_hex(false);
		// create data array
		var data = [];
		for (var i = 0 ; i < (hexstring.length / 2) ; i++) {
			data[i] = parseInt(hexstring.substr(i*2, 2), 16);
		}
		// create blob
		var blob = new Blob([new Uint8Array(data)], {type: "application/octet-stream"});
		// set download link
		link_element.setAttribute("href", URL.createObjectURL(blob));
	}
	read_from_hexadeximal(hexstring) {
		hexstring = hexstring.replace(new RegExp(" *", 'g'), '');
		for (var j = 0 ; j < this.height/8 ; j++)
		{
			for (var i = 0 ; i < this.width/8 ; i++)
			{
				for (var y = 0 ; y < 8 ; y++)
				{
					var data = hexstring.substr(j*(4*this.width)+i*8*4+y*4, 4);
					var strong = parseInt(data.substr(0,2), 16);
					var weak = parseInt(data.substr(2,2), 16);
					for (var x = 0 ; x < 8 ; x++)
					{
						this.array[j*8+y][i*8+x] = ( (weak & (1<<(7-x))) >> (7-x) ) | ( ((strong & (1<<(7-x))) >> (7-x)) << 1 );
					}
				}
			}
		}
		this.update_grid();
	}
}

// centralizes GBSprite instances
class GBSpriteEditor {
	constructor() {
		if (GBSpriteEditor.instance)
			return GBSpriteEditor.instance;
		GBSpriteEditor.instance = this;
		this.sprite_array = new Array();
	}
	// creates and store a new GBSprite
	new_sprite(svg_element, width, height) {
		this.sprite_array.push(new GBSprite(svg_element, width, height));
	}
	// change specified color in palette and update all GBSprites stored
	change_color(index, value) {
		c_array[index] = value;
		for (var sprite of this.sprite_array) {
			sprite.update_grid();
		}
	}
	// returns the GBSprite associated to an svg NS element or null if not found
	get_sprite_by_svg(svg_element) {
		for (var sprite of this.sprite_array)
		{
			if (sprite.svg == svg_element)
				return sprite;
		}
		return null;
	}
	// to use the translate_to_hex function, likely to be replaced someday ?
	sprite_button(button) {
		var b_parent = button.parentElement;
		var svg_element = b_parent.parentElement.getElementsByTagName("svg")[0];
		var sprite = this.get_sprite_by_svg(svg_element);
		var p = b_parent.getElementsByTagName("textarea")[0];
		switch(button.id)
		{
			case "translate-hex":
				p.value = sprite.translate_to_hex();
				break;
			case "gen-dl":
				var link = b_parent.getElementsByTagName("a")[0];
				sprite.generate_download_link(link);
				break;
			case "read-hex":
				sprite.read_from_hexadeximal(p.value);
				break;
		}
	}
}

var editor = new GBSpriteEditor;

"use strict";

const Game = {
	init: function() {
		this.VisualBoard.init();
		this.newGame();

		document.querySelector("#difficulty").addEventListener("change", (function(e) {
			this.newGame();
		}).bind(this));

		const option_inputs = Array.from(document.querySelectorAll("#options input")).filter(function(el) {
			return el.name.startsWith("custom");
		});

		for(let i = 0; i < option_inputs.length; i++) {
			option_inputs[i].addEventListener("change", (function(e) {
				if (document.querySelector("#difficulty").value === "custom") {
					this.newGame();
				}
			}).bind(this));
		}
	},
	newGame: function() {
		let game_specs = this.getGameSpecs();
		this.Board.start(game_specs.width, game_specs.height, game_specs.mines);
		this.VisualBoard.updateBounds();
		this.VisualBoard.draw();
	},
	getGameSpecs: function() {
		let width, height, mines;
		switch (document.querySelector("#difficulty").value) {
			case "easy":
				width = 9;
				height = 9;
				mines = 10;
				break;
			case "medium":
				width = 16;
				height = 16;
				mines = 40;
				break;
			case "hard":
				width = 30;
				height = 16;
				mines = 99;
				break;
			case "custom":
				width = parseInt(document.querySelector("#custom-width").value);
				height = parseInt(document.querySelector("#custom-height").value);
				mines = parseInt(document.querySelector("#custom-mines").value);
				if (width < 4 && height < 4) width = 4;
				if (width < 1) width = 1;
				if (height < 1) height = 1;
				if (mines > width*height - 9) mines = width*height - 9;
				if (mines < 1) mines = 1;
				break;
		}
		return {
			width: width,
			height: height,
			mines: mines
		};
	}
};

Game.Board = {
	CELL_UNTOUCHED: -1,
	CELL_FLAGGED: -2,
	CELL_MINED: -3,

	/*
		We're distinguishing here between "cell coordinates", which are tuples (x, y), and "cell locations",
		which are indices into a flat array that describes the board.
	*/
	coord2loc: function(x, y) { // number cells left-to-right, top-to-bottom, starting from zero
		return (y * this.width) + x;
	},

	start: function(width, height, mine_count) {
		const total_cells = width * height;
		this.width = width;
		this.height = height;
		this.mine_count = mine_count;
		this.indeterminate = true; // mines are unassigned until the first cell is opened
		this.mine_array = [];
		// board state is represented as a simple array of numbers
		// 0-8 = opened with indicated number of adjacent mines, numbers defined above are used for remaining possibilities
		this.state = [];
		for(let i = 0; i < total_cells; i++) {
			this.state.push(this.CELL_UNTOUCHED);
			this.mine_array.push(false);
		}
		this.unflagged_mines = this.mine_count;
		this.cells_left = total_cells - this.mine_count;
		this.lost = false;
	},
	distributeMines: function(initial_click_location) {
		let available_cells = [];
		// the first opened cell and all adjacent cells cannot have mines
		for(let loc = 0; loc < this.width * this.height; loc++) {
			if (!this.areLocsAdjacent(loc, initial_click_location) && loc !== initial_click_location) {
				available_cells.push(loc);
			}
		}
		let mines_placed = 0;
		// choose random locations until all mines have been placed
		while (mines_placed < this.mine_count) {
			let random_index = Math.floor(Math.random() * available_cells.length);
			this.mine_array[available_cells[random_index]] = true;
			available_cells.splice(random_index, 1);
			mines_placed++;
		}
		this.indeterminate = false;
	},
	getCoordState: function(x, y) {
		return this.state[this.coord2loc(x, y)];
	},
	isValidCoordinate: function(x, y) {
		return x >= 0 && x < this.width && y >= 0 && y < this.height;
	},
	getAdjacentCellLocs: function(location) {
		let adjacent = [];
		const x = location % this.width;
		const y = Math.floor(location / this.width);
		for(let dx = -1; dx <= 1; dx++) {
			for(let dy = -1; dy <= 1; dy+=(dx===0 ? 2 : 1)) {
				if (this.isValidCoordinate(x+dx, y+dy)) {
					adjacent.push(this.coord2loc(x+dx, y+dy));
				}
			}
		}
		return adjacent;
	},
	getAdjacentCellCoords: function(x, y) {
		let adjacent = [];
		for(let dx = -1; dx <= 1; dx++) {
			for(let dy = -1; dy <= 1; dy+=(dx===0 ? 2 : 1)) {
				if (this.isValidCoordinate(x+dx, y+dy)) {
					adjacent.push([x+dx, y+dy]);
				}
			}
		}
		return adjacent;
	},
	areLocsAdjacent: function(location1, location2) {
		const xdiff = Math.abs((location1 % this.width) - (location2 % this.width));
		const ydiff = Math.abs(Math.floor(location1 / this.width) - Math.floor(location2 / this.width));
		return ((xdiff === 1 || ydiff === 1) && (xdiff + ydiff <= 2));
	},
	areCoordsAdjacent: function(x1, y1, x2, y2) {
		const xdiff = Math.abs(x1 - x2);
		const ydiff = Math.abs(y1 - y2);
		return ((xdiff === 1 || ydiff === 1) && (xdiff + ydiff <= 2));
	},
	countAdjacentMines: function(location) {
		let adjacent_cells = this.getAdjacentCellLocs(location);
		let count = 0;
		for(let i = 0; i < adjacent_cells.length; i++) {
			if(this.mine_array[adjacent_cells[i]]) count++;
		}
		return count;
	},
	countAdjacentUnopenedCells: function(location) {
		const adjacent = this.getAdjacentCellLocs(location);
		let count = 0;
		for(let i = 0; i < adjacent.length; i++) {
			if((this.state[adjacent[i]] === this.CELL_UNTOUCHED) || (this.state[adjacent[i]] === this.CELL_FLAGGED)) count++;
		}
		return count;
	},
	countAdjacentFlaggedCells: function(location) {
		const adjacent = this.getAdjacentCellLocs(location);
		let count = 0;
		for(let i = 0; i < adjacent.length; i++) {
			if(this.state[adjacent[i]] === this.CELL_FLAGGED) count++;
		}
		return count;
	},
	hasMine: function(x, y) {
		return this.mine_array[this.coord2loc(x, y)];
	},
	openLoc: function(loc) {
		if (this.state[loc] !== this.CELL_UNTOUCHED || this.lost) return;
		if (this.indeterminate) this.distributeMines(loc);
		if (this.mine_array[loc]) {
			this.state[loc] = this.CELL_MINED;
			this.lost = true;
		} else {
			this.state[loc] = this.countAdjacentMines(loc);
			this.cells_left--;
			
			/*
			if (this.state[loc] === 0) {
				const adjacent = this.getAdjacentCellLocs(loc);
				for(let i = 0; i < adjacent.length; i++) {
					this.openLoc(adjacent[i]);
				}
			}
			*/
			// ^ this automatic chording of 0s is already part of the auto-chord
			this.autoPlay(loc);
		}
	},
	openCoord: function(x, y) {
		const loc = this.coord2loc(x, y);
		this.openLoc(loc);
	},
	flagLoc: function(loc) {
		if (this.indeterminate) return;
		if (this.state[loc] === this.CELL_UNTOUCHED) {
			this.state[loc] = this.CELL_FLAGGED;
			this.unflagged_mines--;
			this.autoPlay(loc);
		} else if (this.state[loc] === this.CELL_FLAGGED) {
			this.state[loc] = this.CELL_UNTOUCHED;
			this.unflagged_mines++;
		}
	},
	flagCoord: function(x, y) {
		const loc = this.coord2loc(x, y);
		this.flagLoc(loc);
	},
	chordLoc: function(loc) {
		if (!(this.state[loc] >= 0)) return; // cell must have been opened
		const adjacent = this.getAdjacentCellLocs(loc);
		if (this.countAdjacentFlaggedCells(loc) === this.state[loc]) {
			for(let i = 0; i < adjacent.length; i++) {
				if (this.state[adjacent[i]] === this.CELL_UNTOUCHED) this.openLoc(adjacent[i]);
			}
		}
	},
	chordCoord: function(x, y) {
		const loc = this.coord2loc(x, y);
		this.chordLoc(loc);
	},
	surflagLoc: function(loc) { // "surflag": to flag surrounding cells
		if (!(this.state[loc] >= 0)) return; // cell must have been opened
		const adjacent = this.getAdjacentCellLocs(loc);
		if(this.countAdjacentUnopenedCells(loc) === this.state[loc]) {
			for(let i = 0; i < adjacent.length; i++) {
				if(this.state[adjacent[i]] === this.CELL_UNTOUCHED) this.flagLoc(adjacent[i]);
			}
		}
	},
	surflagCoord: function(x, y) {
		const loc = this.coord2loc(x, y);
		this.surflagLoc(loc);
	},
	autoPlay: function(loc) {
		// try and chord and surflag this cell and all surrounding cells
		// through recursion this will chord and surflag all cells which that can be done to
		const adjacent = this.getAdjacentCellLocs(loc);
		this.surflagLoc(loc);
		this.chordLoc(loc);
		for(let i = 0; i < adjacent.length; i++) {
			this.surflagLoc(adjacent[i]);
			this.chordLoc(adjacent[i]);
		}
	}
}

Game.VisualBoard = {
	init: function() {
		this.canvas = document.querySelector("#game-canvas");
		this.ctx = this.canvas.getContext("2d");
		this.mine_counter = document.querySelector("#mine-counter");

		this.canvas.addEventListener("click", this.inputHandler.bind(this), true);
		this.canvas.addEventListener("contextmenu", this.inputHandler.bind(this), true);
		this.canvas.addEventListener("mousedown", this.inputHandler.bind(this), true);
		this.canvas.addEventListener("mouseup", this.inputHandler.bind(this), true);
		this.canvas.addEventListener("mousemove", this.inputHandler.bind(this), true);

		setInterval((function(){
			const width = this.canvas.clientWidth;
			const height = this.canvas.clientHeight;
			if (this.canvas.width != width || this.canvas.height != height) {
				this.canvas.width = width;
				this.canvas.height = height;
				this.updateBounds();
				this.draw();
			}
		}).bind(this), 100);

		this.mousedown = false;
	},
	inputHandler: function(e) {
		e.preventDefault();
		const cell_x = Math.floor(Game.Board.width * (e.offsetX - this.pos_left) / (this.pos_right - this.pos_left));
		const cell_y = Math.floor(Game.Board.height * (e.offsetY - this.pos_top) / (this.pos_bottom - this.pos_top));

		if (e.type === "mousedown" && e.button === 0) {
			this.mousedown = true;
			this.mousedown_x = cell_x;
			this.mousedown_y = cell_y;
		} else if (e.type === "mouseup" && e.button === 0) {
			this.mousedown = false;
		} else if (e.type === "mousemove") {
			this.mousedown_x = cell_x;
			this.mousedown_y = cell_y;
		} else { // mouse events that affect the board
			if (Game.Board.lost || Game.Board.cells_left === 0) {
				Game.newGame();
			} else if (Game.Board.isValidCoordinate(cell_x, cell_y)) {
				// With the auto-play, manual chording or surflagging is never actually possible.
				// Maybe in the future it'll be decided that auto-play should be toggleable.
				if (e.type === "click") {
					if (Game.Board.getCoordState(cell_x, cell_y) >= 0) {
						Game.Board.chordCoord(cell_x, cell_y);
					} else {
						Game.Board.openCoord(cell_x, cell_y);
					}
				}
				if (e.type === "contextmenu" && !Game.Board.indeterminate) {
					if (Game.Board.getCoordState(cell_x, cell_y) >= 0) {
						Game.Board.surflagCoord(cell_x, cell_y);
					} else {
						Game.Board.flagCoord(cell_x, cell_y);
					}
				}
				// flag all remaining cells (mines) if game is won (this is needed only rarely, when there are mines not adjacent to empty cells)
				if(Game.Board.cells_left === 0) {
					for(let x = 0; x < Game.Board.width; x++) {
						for(let y = 0; y < Game.Board.height; y++) {
							if (Game.Board.getCoordState(x, y) === Game.Board.CELL_UNTOUCHED) Game.Board.flagCoord(x, y);
						}
					}
				}
			}
		}
		this.draw();
	},
	updateBounds: function() {
		const board_ratio = Game.Board.width / Game.Board.height;
		const canvas_ratio = this.canvas.width / this.canvas.height;
		let min_x, min_y, max_x, max_y;
		if (canvas_ratio > board_ratio) {
			const margin = (canvas_ratio - board_ratio) / canvas_ratio;
			min_x = margin / 2;
			min_y = 0;
			max_x = 1 - (margin / 2);
			max_y = 1;
			this.cell_pixel_size = this.canvas.height / Game.Board.height;
		} else if (canvas_ratio <= board_ratio) {
			const margin = (board_ratio - canvas_ratio) / board_ratio;
			min_x = 0;
			min_y = margin / 2;
			max_x = 1;
			max_y = 1 - (margin / 2);
			this.cell_pixel_size = this.canvas.width / Game.Board.width;
		}
		this.pos_left = min_x * this.canvas.width;
		this.pos_right = max_x * this.canvas.width;
		this.pos_top = min_y * this.canvas.height;
		this.pos_bottom = max_y * this.canvas.height;
	},
	draw: function() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillStyle = "#000";
		this.ctx.fillRect(this.pos_left, this.pos_top, this.pos_right - this.pos_left, this.pos_bottom - this.pos_top);
		for(let x = 0; x < Game.Board.width; x++) {
			for(let y = 0; y < Game.Board.height; y++) {
				const cell_state = Game.Board.getCoordState(x, y);
				let depressed = false;
				if (this.mousedown && cell_state === Game.Board.CELL_UNTOUCHED) {
					if (this.mousedown_x === x && this.mousedown_y === y) depressed = true;
					// depress unopened cells adjacent to opened tiles that are clicked
					if (Game.Board.isValidCoordinate(this.mousedown_x, this.mousedown_y) &&
						Game.Board.getCoordState(this.mousedown_x, this.mousedown_y) >= 0 &&
						Game.Board.areCoordsAdjacent(x, y, this.mousedown_x, this.mousedown_y)) depressed = true;
				}
				const draw_mine = (cell_state === Game.Board.CELL_MINED) || (Game.Board.lost && Game.Board.hasMine(x, y));
				this.drawCell(
					this.pos_left + x*this.cell_pixel_size, 
					this.pos_top + y*this.cell_pixel_size,
					this.cell_pixel_size, cell_state, depressed, draw_mine);
			}
		}
		this.mine_counter.textContent = Game.Board.unflagged_mines;
	},
	drawCell: function(px, py, size, cell_state, depressed, draw_mine) {
		const NUMBER_COLORS = ["#69f", "#6f6", "#fc6", "#c3f", "#f66", "#f33", "#f60", "#0f9"]; // based loosely on KMines colors
		const CELL_MARGIN = 0.1;
		if (cell_state >= 0) {
			this.ctx.fillStyle = "#222";
		} else if (cell_state === Game.Board.CELL_FLAGGED) {
			this.ctx.fillStyle = Game.Board.cells_left === 0 ? "#0fc" : "#600";
		} else if (cell_state === Game.Board.CELL_MINED) {
			this.ctx.fillStyle = "#f00";
		} else {
			this.ctx.fillStyle = !depressed ? "#444" : "#234";
		}
		this.ctx.fillRect(px + 0.5*CELL_MARGIN*size, py + 0.5*CELL_MARGIN*size, size - CELL_MARGIN*size, size - CELL_MARGIN*size);
		if (cell_state >= 1) {
			this.ctx.fillStyle = !Game.Board.lost ? NUMBER_COLORS[cell_state-1] : "#d00";
			this.ctx.font = size+"px monospace";
			this.ctx.textAlign = "center";
			this.ctx.fillText(cell_state, px + size / 2, py + 0.82*size);
		}
		if (draw_mine) this.drawMine(px + 0.5*size, py + 0.5*size, size*0.7);
	},
	drawMine: function(px, py, size) {
		this.ctx.beginPath();
		this.ctx.arc(px, py, size/2, 0, Math.PI * 2, true);
		this.ctx.fillStyle = "#000";
		this.ctx.fill();
	}
}

Game.init();

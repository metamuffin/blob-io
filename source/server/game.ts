import { GLOBAL_CONFIG, VERBOSE } from "../global";
import { Cell } from "./cell";
import { FoodCell } from "./cell_types/food";
import { PlayerCell } from "./cell_types/player";
import { distance } from "./helper";
import { Box, Quadtree } from "./quadtree";


export class Game {
    public cell_lookup: Map<string, Cell> = new Map()
    public name_lookup: Map<string, PlayerCell[]> = new Map()
    public quadtree: Quadtree

    constructor() {
        this.quadtree = new Quadtree(new Box(0, 0, GLOBAL_CONFIG.map_size, GLOBAL_CONFIG.map_size))
        for (let i = 0; i < GLOBAL_CONFIG.natural_food_count; i++) {
            this.spawn_food()
        }
    }

    add_cell(c: Cell) {
        if (VERBOSE) console.log(`Add cell ${c.id}`);
        c.alive = true
        this.cell_lookup.set(c.id, c)
        this.quadtree.insert(c)
        if (c instanceof PlayerCell) {
            if (!this.name_lookup.has(c.name)) this.name_lookup.set(c.name, [])
            var l = this.name_lookup.get(c.name)
            if (!l) throw new Error("This should not happen at all");
            // console.log(`there were ${l.length} cells for this player already`);
            l.push(c)
        }

    }
    remove_cell(c: Cell) {
        if (VERBOSE) console.log(`Remove cell ${c.id}`);
        if (!c.alive) throw new Error("Tried to remove dead cell");
        c.alive = false
        this.cell_lookup.delete(c.id)
        if (this.quadtree.remove(c) != 1) throw new Error("cell was moved!!!!!!!!a")
        if (c instanceof PlayerCell) {
            var l = this.name_lookup.get(c.name)
            if (!l) throw new Error("Could not remove cell from name lookup map");
            // console.log(`there were ${l.length} cells for this player before.`);
            let si = l.findIndex(a => a === c)
            if (si == -1) throw new Error("Could not remove cell from name lookup map");
            l.splice(si, 1)
            // console.log(`now there are ${this.name_lookup.get(c.name)?.length} left`);
            if (l.length == 0) this.name_lookup.delete(c.name)
        }
    }
    update_cell_start(c: Cell) {
        if (this.quadtree.remove(c) != 1) throw new Error("cell was moved!!!!!!!!b")
    }
    update_cell_end(c: Cell) {
        this.quadtree.insert(c)
    }

    public tick() {
        this.quadtree.for_each(cell => {
            var near = Object.values(this.quadtree.query(new Box(
                cell.x - cell.radius,
                cell.y - cell.radius,
                cell.x + cell.radius,
                cell.y + cell.radius,
            )))
            cell.tick(near)
        })
    }

    legacy_get_cell_view(c: Cell): { [key: string]: Cell } {
        let box = new Box(c.x - c.radius * GLOBAL_CONFIG.view_radius, c.y - c.radius * GLOBAL_CONFIG.view_radius, c.x + c.radius * GLOBAL_CONFIG.view_radius, c.y + c.radius * GLOBAL_CONFIG.view_radius)
        var rough = this.quadtree.query(box)
        var exact: { [key: string]: Cell } = {}
        for (const cell of Object.values(rough)) {
            var d = distance(cell.x, cell.y, c.x, c.y)
            if (d <= GLOBAL_CONFIG.view_radius * c.radius) exact[cell.id] = cell
        }
        return exact
    }

    get_player_view(name: string): Cell[] {
        var player_cells = this.name_lookup.get(name)
        if (!player_cells) return []

        var center_x = player_cells.reduce((a, v) => a + v.x, 0) / player_cells.length
        var center_y = player_cells.reduce((a, v) => a + v.y, 0) / player_cells.length
        var view_radius = Math.sqrt(player_cells.reduce((a, v) => a + v.radius, 0)) * GLOBAL_CONFIG.view_radius
        var box = new Box(
            center_x - view_radius,
            center_y - view_radius,
            center_x + view_radius,
            center_y + view_radius
        )

        var view = Object.values(this.quadtree.query(box))
        view.filter(cell => {
            var d = distance(cell.x, cell.y, center_x, center_y)
            return d <= view_radius
        })
        return view
    }

    get_spectator_view(x: number, y: number, r: number): Cell[] {
        return Object.values(this.quadtree.query(new Box(x - r / 2, y - r / 2, x + r / 2, y + r / 2)))
    }

    spawn_player(name: string) {
        if (VERBOSE) console.log("Spawn player: " + name);
        var cell = new PlayerCell(this, name)
        cell.x = GLOBAL_CONFIG.map_size * Math.random()
        cell.y = GLOBAL_CONFIG.map_size * Math.random()
        this.add_cell(cell)
    }

    spawn_food() {
        var cell = new FoodCell(this)
        cell.x = Math.random() * (GLOBAL_CONFIG.map_size - GLOBAL_CONFIG.natural_food_inset * 2) + GLOBAL_CONFIG.natural_food_inset
        cell.y = Math.random() * (GLOBAL_CONFIG.map_size - GLOBAL_CONFIG.natural_food_inset * 2) + GLOBAL_CONFIG.natural_food_inset
        cell.radius = GLOBAL_CONFIG.natural_food_radius
        cell.natural = true
        this.add_cell(cell)
    }
}


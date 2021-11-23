const zoom_modes = {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
};
const block_width_multiplyer = {
    'day': 1,
    'week': 7,
    'month': 30,
    'year': 365,
};
const OPTIONS = {
    width: document.body.clientWidth,
    height: 100,
    center_y: 50,
    right_x: document.body.clientWidth,
    left_x: 0,
    zoom_event: 'zoom',
    block_base_width: 200,
};
const colors = {
    'day': ['#999', '#CCC'],
    'week': ['#F99', '#FCC'],
    'month': ['#9F9', '#CFC'],
    'year': ['#99F', '#CCF'],
};

let svg_transform = { k: 1, x: 0, y: 0 };
let svg_pos = {
    start: -OPTIONS.width,
    end: 0,
};
let zoom_mode = zoom_modes.DAY;

const zoom_handler = () => {
    svg_transform = d3.event.transform;
    svg_transform.y = 0;

    update_svg_pos();
    no_future();
    update_svg_pos();
    draw_endpoints();
    draw_blocks();
    
    svg.attr('transform', `translate(${svg_transform.x}, ${svg_transform.y}) scale(${svg_transform.k}, 1)`)
};


// Create scale
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const time_scale = d3.scaleTime().domain([yesterday, today]).range([-OPTIONS.block_base_width, 0])


const svg = d3.select('#timeline')
    .append('svg')
    .attr('width', OPTIONS.width)
    .attr('height', OPTIONS.height)
    .call(d3.zoom().on(OPTIONS.zoom_event, zoom_handler))
    .append('g')
    .attr('transform', `translate(${OPTIONS.width}, 0) scale(1,1)`);


const update_svg_pos = () => {
    svg_pos.start = -svg_transform.x / svg_transform.k;
    svg_pos.end = (OPTIONS.width - svg_transform.x) / svg_transform.k;
}

const draw_endpoints = () => {
    const color = svg_pos.end == 0 ? 'red' : 'black';
    const width = 4 / svg_transform.k;

    svg.selectAll('rect.border').remove();
    svg
        .append('rect')
        .attr('class', 'border')
        .attr('x', svg_pos.start)
        .attr('y', OPTIONS.center_y-25)
        .attr('width', width)
        .attr('height', 50)
        .style('fill', 'black');

    
    svg
        .append('rect')
        .attr('class', 'border')
        .attr('x', svg_pos.end-width)
        .attr('y', OPTIONS.center_y-25)
        .attr('width', width)
        .attr('height', 50)
        .style('fill', color);
};

/* TODO: 
Rewrite to first calculate ticks and based on that create blocks + labels.
Current approach does not work since months (and years) are not of equal length.
1. determine which ticks are in current frame (depending on zoom_mode).
2. loop over ticks.
    a. create label with correct date format (depending on zoom_mode).
    b. create block from prev to next tick.
*/
const draw_blocks = () => {
    const block_width = OPTIONS.block_base_width * block_width_multiplyer[zoom_mode];
    let first_block_num = Math.ceil(Math.abs(svg_pos.end) / block_width);
    let last_block_num = Math.ceil(Math.abs(svg_pos.start) / block_width) +1;
    let num_blocks = last_block_num - first_block_num;

    let first_block_offset = 0;
    if (zoom_mode == zoom_modes.WEEK) {
        first_block_offset = today.getDay() * OPTIONS.block_base_width * block_width_multiplyer['day'];
        first_block_num--;
        num_blocks++;
    } else if (zoom_mode == zoom_modes.MONTH) {
        first_block_offset = (today.getDate()-1) * OPTIONS.block_base_width * block_width_multiplyer['day'];
        first_block_num--;
        num_blocks++;
    }

    const prev_zoom_mode = zoom_mode;
    switch (zoom_mode) {
        case zoom_modes.DAY:
            if (num_blocks > 21) {
                // console.log('switch day', num_blocks)
                zoom_mode = zoom_modes.WEEK;
            }
            break;
        case zoom_modes.WEEK:
            if (num_blocks > 9) {
                // console.log('switch week', num_blocks)
                zoom_mode = zoom_modes.MONTH;
            } else if (num_blocks < 4) {
                // console.log('switch week', num_blocks)
                zoom_mode = zoom_modes.DAY;
            }
            break;
        case zoom_modes.MONTH:
            if (num_blocks > 24) {
                // console.log('switch month', num_blocks)
                zoom_mode = zoom_modes.YEAR;
            } else if (num_blocks < 3) {
                // console.log('switch month', num_blocks)
                zoom_mode = zoom_modes.WEEK;
            }
            break;
        case zoom_modes.YEAR:
            if (num_blocks > 20) {
                // console.log('switch year', num_blocks)
            } else if (num_blocks < 3) {
                // console.log('switch week', num_blocks)
                zoom_mode = zoom_modes.MONTH;
            }
            break;
    }
    
    if (prev_zoom_mode != zoom_mode)
        return draw_blocks();

    svg.selectAll('rect.block').remove();
    svg.selectAll('text.block').remove();

    for (let i = first_block_num; i < last_block_num; i++) {
        const x = -i * block_width - first_block_offset;
        const d = time_scale.invert(x+5);
        svg
            .append('rect')
            .attr('class', 'block')
            .attr('x', x)
            .attr('y', OPTIONS.center_y-5)
            .attr('width', block_width)
            .attr('height', 10)
            .style('fill', colors[zoom_mode][i%2]);
        svg
            .append('text')
            .attr('class', 'block')
            .text(d.toDateString().substring(4, 10))
            .attr('x', (x-0) * svg_transform.k)
            .attr('y', OPTIONS.center_y-5)
            .attr('transform', `scale(${1/svg_transform.k},1)`)
    }

};

const no_future = () => {
    // future shown if svg_pos.end > 0
    if (svg_pos.end > 0) {
        svg_transform.x = OPTIONS.width;
    }
};

draw_endpoints()
draw_blocks()
/*
TODO:
x only scale in x direction
- first milestone: empty timeline with hour/day/month/year/century markings depending on zoom level
- zoom_mode should not change when just translating
- changing browser size should update svg.
- week / month / year should start at mon/1/jan
- start view: last n years?
- only remove/create stuff that moved in or out of window
*/
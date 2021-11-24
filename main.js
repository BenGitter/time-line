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
    update_zoom_mode();
    const [t, y_t] = calculate_ticks()
    draw_ticks(t);
    draw_year_ticks(y_t);
    // draw_blocks();
    
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

// Date::getTime() returns number of *milliseconds* since Jan 1, 1970
const DAY_MILLIS = 24*60*60*1000;
const WEEK_MILLIS = 7*24*60*60*1000;
const MONTH_MILLIS = 31*24*60*60*1000; // for 31-day month
const YEAR_MILLIS = 365*24*60*60*1000; // for 365-day year

const max_time_window = {
    'day': 16*DAY_MILLIS,
    'week': 9*WEEK_MILLIS,
    'month': 24*MONTH_MILLIS,
    'year': 20*YEAR_MILLIS,
};

const next_zoom_mode = {
    'day': zoom_modes.WEEK,
    'week': zoom_modes.MONTH,
    'month': zoom_modes.YEAR,
    'year': zoom_modes.YEAR,
}
const prev_zoom_mode = {
    'day': zoom_modes.DAY,
    'week': zoom_modes.DAY,
    'month': zoom_modes.WEEK,
    'year': zoom_modes.MONTH,
}

const update_zoom_mode = () => {
    const start_date = time_scale.invert(svg_pos.start);
    const end_date = time_scale.invert(svg_pos.end);
    const time_window = end_date.getTime() - start_date.getTime();

    // update zoom_mode if time_window is too big or too small
    if (time_window > max_time_window[zoom_mode]) {
        zoom_mode = next_zoom_mode[zoom_mode];
    } else if (time_window < max_time_window[prev_zoom_mode[zoom_mode]]) {
        zoom_mode = prev_zoom_mode[zoom_mode];
    }
};

const calculate_ticks = () => {
    const start_date = time_scale.invert(svg_pos.start);
    const end_date = time_scale.invert(svg_pos.end);
    end_date.setHours(0,0,0,0);
    start_date.setHours(0,0,0,0);

    let ticks = [];
    let year_ticks = [];

    if (start_date.getFullYear() != end_date.getFullYear() && zoom_mode != zoom_modes.YEAR) {
        const first_year = new Date(start_date.getFullYear()+1, 0, 1);
        const last_year = new Date(end_date.getFullYear(), 0, 1);
        year_ticks.push({ x: time_scale(first_year), d: first_year.getFullYear() });
        if (first_year < last_year) year_ticks.push({ x: time_scale(last_year), d: last_year.getFullYear() });
    }

    if (zoom_mode == zoom_modes.DAY) {
        start_date.setDate(start_date.getDate()+1);
        end_date.setDate(end_date.getDate());
        const num_ticks = (end_date.getTime() - start_date.getTime()) / DAY_MILLIS +1;

        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setDate(d.getDate() + i);
            ticks.push({ x: time_scale(d), d: d.toDateString().substring(4, 10) });
        }
    } else if (zoom_mode == zoom_modes.WEEK) {
        start_date.setDate(start_date.getDate() - start_date.getDay() +7);
        end_date.setDate(end_date.getDate() - end_date.getDay());
        const num_ticks = (end_date.getTime() - start_date.getTime()) / WEEK_MILLIS +1;

        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setDate(d.getDate() + 7*i);
            ticks.push({ x: time_scale(d), d: d.toDateString().substring(4, 10) });
        }
    } else if (zoom_mode == zoom_modes.MONTH) {
        start_date.setDate(1);
        start_date.setMonth(start_date.getMonth()+1);
        end_date.setDate(1);
        const num_ticks = Math.round((end_date.getTime() - start_date.getTime()) / MONTH_MILLIS) +1;

        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setMonth(d.getMonth() + i);
            let s = d.toDateString().substring(4, 7) + d.toDateString().substring(10) 
            ticks.push({ x: time_scale(d), d: d.toDateString().substring(4, 7) });
        }
    } else if (zoom_mode == zoom_modes.YEAR) {
        start_date.setDate(1);
        start_date.setMonth(0);
        start_date.setFullYear(start_date.getFullYear()+1);
        end_date.setDate(1);
        end_date.setMonth(0);
        const num_ticks = Math.round((end_date.getTime() - start_date.getTime()) / YEAR_MILLIS) +1;

        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setFullYear(d.getFullYear() + i);
            ticks.push({ x: time_scale(d), d: d.getFullYear() });
        }
    }

    if (ticks.length > 25) {
        console.log('[WARNING] Too many ticks');
    }
    return [ticks, year_ticks];
};

const draw_ticks = (ticks) => {
    svg.selectAll('rect.tick').remove();
    svg.selectAll('text.tick').remove();
    for (const tick of ticks) {
        svg
            .append('rect')
            .attr('class', 'tick')
            .attr('x', tick.x-2 / svg_transform.k)
            .attr('y', OPTIONS.center_y-5)
            .attr('width', 2 / svg_transform.k)
            .attr('height', 20)
            .style('fill', 'red');
        svg
            .append('text')
            .attr('class', 'tick')
            .text(tick.d)
            .attr('x', (tick.x-0) * svg_transform.k)
            .attr('y', OPTIONS.center_y-5)
            .attr('transform', `scale(${1/svg_transform.k},1)`)
    }
}

const draw_year_ticks = (ticks) => {
    svg.selectAll('rect.year_tick').remove();
    svg.selectAll('text.year_tick').remove();
    for (const tick of ticks) {
        svg
            .append('rect')
            .attr('class', 'year_tick')
            .attr('x', tick.x-2 / svg_transform.k)
            .attr('y', OPTIONS.center_y-35)
            .attr('width', 2 / svg_transform.k)
            .attr('height', 40)
            .style('fill', 'red');
        svg
            .append('text')
            .attr('class', 'year_tick')
            .text(tick.d)
            .attr('x', (tick.x) * svg_transform.k +3)
            .attr('y', OPTIONS.center_y-20)
            .attr('transform', `scale(${1/svg_transform.k},1)`)
    }
}

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
        // svg
        //     .append('text')
        //     .attr('class', 'block')
        //     .text(d.toDateString().substring(4, 10))
        //     .attr('x', (x-0) * svg_transform.k)
        //     .attr('y', OPTIONS.center_y-5)
        //     .attr('transform', `scale(${1/svg_transform.k},1)`)
    }

};

const no_future = () => {
    // future shown if svg_pos.end > 0
    if (svg_pos.end > 0) {
        svg_transform.x = OPTIONS.width;
    }
};

draw_endpoints()
const [t, y_t] = calculate_ticks()
draw_ticks(t);
draw_year_ticks(y_t);
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
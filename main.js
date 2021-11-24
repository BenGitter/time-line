const zoom_modes = {
    MIN: 'min',
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
    MAX: 'max',
};
const block_width_multiplyer = {
    'day': 1,
    'week': 7,
    'month': 30,
    'year': 365,
};
const OPTIONS = {
    width: document.body.clientWidth,
    height: 200,
    center_y: 100,
    main_row_y: 40,
    main_row_height: 40,
    second_row_y: 80,
    second_row_height: 30,
    right_x: document.body.clientWidth,
    left_x: 0,
    zoom_event: 'zoom',
    block_base_width: 100,
};
const colors = {
    'day': ['#999', '#CCC'],
    'week': ['#F99', '#FCC'],
    'month': ['#9F9', '#CFC'],
    'year': ['#99F', '#CCF'],
};

let prev_svg_transform = { k: 1, x: 0, y: 0 };
let svg_transform = { k: 1, x: 0, y: 0 };
let svg_pos = {
    start: -OPTIONS.width,
    end: 0,
};
let zoom_mode = zoom_modes.DAY;
let svg, g, time_scale, zoom; // initialized in startup

// Date::getTime() returns number of *milliseconds* since Jan 1, 1970
const DAY_MILLIS = 24*60*60*1000;
const WEEK_MILLIS = 7*24*60*60*1000;
const MONTH_MILLIS = 31*24*60*60*1000; // for 31-day month
const YEAR_MILLIS = 365*24*60*60*1000; // for 365-day year

const max_time_window = {
    'min': DAY_MILLIS,
    'day': 16*DAY_MILLIS,
    'week': 9*WEEK_MILLIS,
    'month': 24*MONTH_MILLIS,
    'year': 20*YEAR_MILLIS,
    'max': 20*YEAR_MILLIS,
};

const next_zoom_mode = {
    'min': zoom_modes.DAY,
    'day': zoom_modes.WEEK,
    'week': zoom_modes.MONTH,
    'month': zoom_modes.YEAR,
    'year': zoom_modes.MAX,
    'max': zoom_modes.MAX,
}
const prev_zoom_mode = {
    'min': zoom_modes.MIN,
    'day': zoom_modes.MIN,
    'week': zoom_modes.DAY,
    'month': zoom_modes.WEEK,
    'year': zoom_modes.MONTH,
    'max': zoom_modes.YEAR,
}

const startup = () => {
    // Create scale
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    time_scale = d3.scaleTime().domain([yesterday, today]).range([-OPTIONS.block_base_width, 0])

    // Create SVG with initial transformation (right edge == 0)
    zoom = d3.zoom().on(OPTIONS.zoom_event, zoom_handler);
    const tr = d3.zoomIdentity.translate(OPTIONS.width,0).scale(1)
    svg = d3.select('#timeline')
        .append('svg')
        .attr('width', OPTIONS.width)
        .attr('height', OPTIONS.height);
    g = svg.append('g')
    svg.call(zoom).call(zoom.transform, tr)
}

// programmatical zoom events can be detected with:  if (d3.event.sourceEvent == undefined)
const zoom_handler = () => {
    // copy transform and make sure y translation is ignored
    svg_transform = d3.event.transform;
    svg_transform.y = 0;

    update_svg_pos();                   // calculate edge coordinates
    update_zoom_mode();                 // update zoom mode if necessary
    no_future();                        // make sure future dates are not in view
    update_svg_pos();                   // update edge coordinates (in case no_future changed transform)
    // draw_endpoints();                   // draw the edges
    const [t, y_t] = calculate_ticks()  // calculate tick positions and labels for normal ticks (t) and year ticks (y_t)
    draw_blocks(t);                     // draw blocks in between ticks 
    draw_ticks(t);                      // draw the normal ticks
    draw_year_ticks(y_t);               // draw the year ticks
    
    // transform svg and save state
    g.attr('transform', `translate(${svg_transform.x}, ${svg_transform.y}) scale(${svg_transform.k}, 1)`)
    prev_svg_transform = svg_transform;
};

const update_svg_pos = () => {
    svg_pos.start = -svg_transform.x / svg_transform.k;
    svg_pos.end = (OPTIONS.width - svg_transform.x) / svg_transform.k;
}

const draw_endpoints = () => {
    const color = svg_pos.end == 0 ? 'red' : 'black';
    const width = 4 / svg_transform.k;

    g.selectAll('rect.border').remove();
    g
        .append('rect')
        .attr('class', 'border')
        .attr('x', svg_pos.start)
        .attr('y', OPTIONS.center_y-25)
        .attr('width', width)
        .attr('height', 50)
        .style('fill', 'black');

    g
        .append('rect')
        .attr('class', 'border')
        .attr('x', svg_pos.end-width)
        .attr('y', OPTIONS.center_y-25)
        .attr('width', width)
        .attr('height', 50)
        .style('fill', color);
};

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

    if (zoom_mode == zoom_modes.MIN || zoom_mode == zoom_modes.MAX) {
        console.log(`[${zoom_mode}] Cannot zoom further`);
        svg_transform = prev_svg_transform;
        svg.call(zoom.transform, svg_transform);
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
        start_date.setDate(start_date.getDate());
        end_date.setDate(end_date.getDate());
        const num_ticks = (end_date.getTime() - start_date.getTime()) / DAY_MILLIS +1;

        let color_i = Math.round(Math.abs(start_date.getTime()) / DAY_MILLIS) % 2;
        for (let i = 0; i < num_ticks; i++) {
            color_i = (color_i +1) % 2;
            let d = new Date(start_date.getTime());
            d.setDate(d.getDate() + i);
            ticks.push({ 
                x: time_scale(d), 
                d: d.toDateString().substring(4, 10),
                color_i: color_i,
            });
        }
    } else if (zoom_mode == zoom_modes.WEEK) {
        start_date.setDate(start_date.getDate() - start_date.getDay() +7);
        end_date.setDate(end_date.getDate() - end_date.getDay());
        const num_ticks = (end_date.getTime() - start_date.getTime()) / WEEK_MILLIS +1;
        
        let color_i = Math.round(Math.abs(start_date.getTime()) / DAY_MILLIS) % 2;
        for (let i = 0; i < num_ticks; i++) {
            color_i = (color_i +1) % 2;
            let d = new Date(start_date.getTime());
            d.setDate(d.getDate() + 7*i);
            ticks.push({ 
                x: time_scale(d), 
                d: d.toDateString().substring(4, 10),
                color_i: color_i,
            });
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
            ticks.push({ 
                x: time_scale(d), 
                d: d.toDateString().substring(4, 7),
                color_i: d.getMonth() % 2,
            });
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
            ticks.push({ 
                x: time_scale(d), 
                d: d.getFullYear(),
                color_i: d.getFullYear() % 2,
            });
        }
    }

    if (ticks.length > 25) {
        console.log('[WARNING] Too many ticks');
    }
    return [ticks, year_ticks];
};

const draw_ticks = (ticks) => {
    g.selectAll('rect.tick').remove();
    g.selectAll('text.tick').remove();

    const offset = (ticks[1].x - ticks[0].x) / 2;
    for (const tick of ticks) {
        // g
        //     .append('rect')
        //     .attr('class', 'tick')
        //     .attr('x', tick.x-2 / svg_transform.k)
        //     .attr('y', OPTIONS.center_y-10)
        //     .attr('width', 2 / svg_transform.k)
        //     .attr('height', 20)
        //     .style('fill', 'red');
        g
            .append('text')
            .attr('class', 'tick')
            .text(tick.d)
            .attr('x', (tick.x + offset) * svg_transform.k)
            .attr('y', OPTIONS.main_row_y + OPTIONS.main_row_height/2 + 5)
            .attr('transform', `scale(${1/svg_transform.k},1)`)
            .attr('text-anchor', 'middle')
            .style('fill', '#666');
    }
}

const draw_year_ticks = (ticks) => {
    g.selectAll('rect.year_tick').remove();
    g.selectAll('text.year_tick').remove();
    for (const tick of ticks) {
        g
            .append('rect')
            .attr('class', 'year_tick')
            .attr('x', tick.x-2 / svg_transform.k)
            .attr('y', OPTIONS.center_y-35)
            .attr('width', 2 / svg_transform.k)
            .attr('height', 40)
            .style('fill', 'red');
        g
            .append('text')
            .attr('class', 'year_tick')
            .text(tick.d)
            .attr('x', (tick.x) * svg_transform.k +3)
            .attr('y', OPTIONS.center_y-20)
            .attr('transform', `scale(${1/svg_transform.k},1)`)
    }
}

const draw_blocks = (ticks) => {
    g.selectAll('rect.block').remove();

    const last_tick = ticks[ticks.length-1]
    if (last_tick.x != svg_pos.end) {
        ticks.push({ x: svg_pos.end, d: '', color_i: (last_tick.color_i +1) % 2 });
    }

    let last_block = svg_pos.start;
    let test_colors = ['#EAEAEA', '#EEF']

    g
        .append('rect')
        .attr('class', 'block')
        .attr('x', svg_pos.start)
        .attr('y', OPTIONS.main_row_y -2)
        .attr('width', svg_pos.end - svg_pos.start)
        .attr('height', 2)
        .style('fill', '#999');

    for (const tick of ticks) {
        const width = tick.x - last_block;
        g
            .append('rect')
            .attr('class', 'block')
            .attr('x', last_block)
            .attr('y', OPTIONS.main_row_y)
            .attr('width', width)
            .attr('height', OPTIONS.main_row_height)
            .style('fill', test_colors[tick.color_i]);
        g
            .append('rect')
            .attr('class', 'block')
            .attr('x', last_block)
            .attr('y', OPTIONS.second_row_y)
            .attr('width', width)
            .attr('height', 30)
            .style('fill', '#F5F5F5');
        
        last_block = tick.x;
    }
};

const no_future = () => {
    // future shown if svg_pos.end > 0
    if (svg_pos.end > 0) {
        svg_transform.x = OPTIONS.width;
    }
};

startup()


/*
TODO:
x only scale in x direction
x zoom_mode should not change when just translating
x week / month / year should start at mon/1/jan
- first milestone: empty timeline with hour/day/month/year/century markings depending on zoom level
- update color scheme
- labels inside blocks?
- changing browser size should update svg
- start view: last n years?
- smaller zoom modes: hours and minutes
- only remove/create stuff that moved in or out of window
*/
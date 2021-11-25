const zoom_modes = {
    MIN: 'min',
    DAY: 'day',
    MONTH: 'month',
    YEAR: 'year',
    DECADE: 'decade',
    CENTURY: 'century',
    MILLENNIUM: 'millennium',
    MAX: 'max',
};
const OPTIONS = {
    width: document.body.clientWidth,
    height: 200,
    center_y: 100,
    main_row_y: 40,
    main_row_height: 40,
    second_row_y: 80,
    second_row_height: 30,
    zoom_event: 'zoom',
    block_base_width: 20,
};
const COLORS = {
    // main_row: ['#EFEFEF', '#EAEAEA'],
    main_row: ['#E1E1E1', '#D1D1D1'],
    second_row: '#F5F5F5',
    axis: '#999',
    tick: '#999',
    tick_text: '#666',
}

let prev_svg_transform = { k: 1, x: 0, y: 0 };
let svg_transform = { k: 1, x: 0, y: 0 };
let svg_pos = {
    start: -OPTIONS.width,
    end: 0,
};
let zoom_mode = zoom_modes.DAY;
let svg, g, d3_time_scale, zoom; // initialized in startup

// Date::getTime() returns number of *milliseconds* since Jan 1, 1970
const DAY_MILLIS = 24*60*60*1000;
const MONTH_MILLIS = 31*DAY_MILLIS; // for 31-day month
const YEAR_MILLIS = 365.25*DAY_MILLIS; // for 365-day year
const DECADE_MILLIS = 10*YEAR_MILLIS;
const CENTURY_MILLIS = 10*DECADE_MILLIS;
const MILLENNIUM_MILLIS = 10*CENTURY_MILLIS;

const zoom_settings = {
    min: {
        max_window: DAY_MILLIS,
        next_mode: zoom_modes.DAY,
        prev_mode: zoom_modes.MIN,
    },
    day: {
        max_window: 3*MONTH_MILLIS,
        next_mode: zoom_modes.MONTH,
        prev_mode: zoom_modes.MIN,
    },
    month: {
        max_window: 4*YEAR_MILLIS,
        next_mode: zoom_modes.YEAR,
        prev_mode: zoom_modes.DAY,
    },
    year: {
        max_window: 40*YEAR_MILLIS,
        next_mode: zoom_modes.DECADE,
        prev_mode: zoom_modes.MONTH,
    },
    decade: {
        max_window: 40*DECADE_MILLIS,
        next_mode: zoom_modes.CENTURY,
        prev_mode: zoom_modes.YEAR,
    },
    century: {
        max_window: 40*CENTURY_MILLIS,
        next_mode: zoom_modes.MILLENNIUM,
        prev_mode: zoom_modes.DECADE,
    },
    millennium: {
        max_window: 40*MILLENNIUM_MILLIS,
        next_mode: zoom_modes.MAX,
        prev_mode: zoom_modes.CENTURY,
    },
    max: {
        max_window: 40*MILLENNIUM_MILLIS,
        next_mode: zoom_modes.MAX,
        prev_mode: zoom_modes.YEAR,
    },
};

const startup = () => {
    create_svg();
    create_gradients();

    window.addEventListener('resize', e => {
        OPTIONS.width = document.body.clientWidth;
        svg.attr('width', OPTIONS.width)
        zoom_handler(true);
        // d3.select('#timeline').html('');
        // create_svg();
    })
}

let time_scale = x => d3_time_scale(x);
time_scale.invert = x => d3_time_scale.invert(x);

// let time_scale = x => d3_time_scale(x - svg_pos.end);
// time_scale.invert = x => d3_time_scale.invert(x + svg_pos.end);

// const update_time_scale = () => {
    // time_scale = x => d3_time_scale(x) - svg_pos.end;
    // time_scale.invert = x => d3_time_scale.invert(x + svg_pos.end);
// }

const create_svg = () => {
    // Create scale
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d3_time_scale = d3.scaleTime().domain([yesterday, now]).range([-OPTIONS.block_base_width, 0])

    // Create SVG with initial transformation (right edge == 0)
    zoom = d3.zoom().on(OPTIONS.zoom_event, zoom_handler);
    const tr = d3.zoomIdentity.translate(OPTIONS.width, 1.2345).scale(2)
    svg = d3.select('#timeline')
        .append('svg')
        .attr('width', OPTIONS.width)
        .attr('height', OPTIONS.height);
    g = svg.append('g')
    svg.call(zoom).call(zoom.transform, tr)
}

const create_gradients = () => {
    const defs = svg.append('defs');
    const grad_main_dark = defs
        .append('linearGradient')
        .attr('id', 'grad_main_dark')
        .attr('x1', '0%')
        .attr('x2', '0%')
        .attr('y1', '0%')
        .attr('y2', '100%');
    grad_main_dark
        .append('stop')
        .attr('offset', '0%')
        .style('stop-color', COLORS.main_row[1]);
    grad_main_dark
        .append('stop')
        .attr('offset', '100%')
        .style('stop-color', COLORS.second_row);

    const grad_main_light = defs
        .append('linearGradient')
        .attr('id', 'grad_main_light')
        .attr('x1', '0%')
        .attr('x2', '0%')
        .attr('y1', '0%')
        .attr('y2', '100%');
    grad_main_light
        .append('stop')
        .attr('offset', '0%')
        .style('stop-color', COLORS.main_row[0]);
    grad_main_light
        .append('stop')
        .attr('offset', '100%')
        .style('stop-color', COLORS.second_row);
};

// programmatical zoom events can be detected with:  if (d3.event.sourceEvent == undefined)
const zoom_handler = (external_zoom = false) => {
    let first = true; // CHANGE to true for default behaviour
    if (d3.event.transform.y == 1.2345) {
        first = true;
    }

    // copy transform and make sure y translation is ignored
    if (!external_zoom) {
        svg_transform = d3.event.transform;
        svg_transform.y = 0;
    } 
    console.log(d3.event.transform)
    update_svg_pos();                   // calculate edge coordinates
    update_zoom_mode();                 // update zoom mode if necessary
    no_future();                        // make sure future dates are not in view
    
    update_svg_pos();                   // update edge coordinates (in case no_future changed transform)
    // update_time_scale();
    const main_ticks = calculate_ticks()  // calculate tick positions and labels for normal ticks (t) and year ticks (y_t)
    // const secondary_ticks = calculate_secondary_ticks();
    draw_blocks(main_ticks);                     // draw blocks in between ticks 
    draw_ticks(main_ticks);                      // draw the normal ticks
    // draw_year_ticks(secondary_ticks);               // draw the year ticks
    
    // transform svg and save state
    // console.log(svg_pos.end)
    // g.attr('transform-origin', `${svg_pos.end}px 0`)
    if (first) {
        g.attr('transform', `translate(${svg_transform.x}, 0) scale(${svg_transform.k}, 1)`);
    } else {
        g.attr('transform', `translate(0, 0) scale(${svg_transform.k}, 1)`);
    }
    
    // g.attr('transform', `translate(${svg_transform.x}, ${svg_transform.y}) scale(${svg_transform.k}, 1)`);
    prev_svg_transform = svg_transform;
};

const update_svg_pos = () => {
    svg_pos.start = -svg_transform.x / svg_transform.k;
    svg_pos.end = (OPTIONS.width - svg_transform.x) / svg_transform.k;
}

const update_zoom_mode = () => {
    const start_date = time_scale.invert(svg_pos.start);
    const end_date = time_scale.invert(svg_pos.end);
    const time_window = end_date.getTime() - start_date.getTime();

    // update zoom_mode if time_window is too big or too small
    if (time_window > zoom_settings[zoom_mode].max_window) {
        zoom_mode = zoom_settings[zoom_mode].next_mode;
        update_zoom_mode();
    } else if (time_window < zoom_settings[zoom_settings[zoom_mode].prev_mode].max_window) {
        zoom_mode = zoom_settings[zoom_mode].prev_mode;
        update_zoom_mode();
    }

    if (zoom_mode == zoom_modes.MIN || zoom_mode == zoom_modes.MAX) {
        console.log(`[${zoom_mode}] Cannot zoom further`);
        svg_transform = prev_svg_transform;
        svg.call(zoom.transform, svg_transform);
    }
};

const calculate_secondary_ticks = () => {
    const start_date = time_scale.invert(svg_pos.start);
    const end_date = time_scale.invert(svg_pos.end);
    end_date.setHours(0,0,0,0);
    start_date.setHours(0,0,0,0);

    let ticks = [];
    if (start_date.getFullYear() != end_date.getFullYear() && zoom_mode != zoom_modes.YEAR) {
        const first_year = new Date(start_date.getFullYear()+1, 0, 1);
        const last_year = new Date(end_date.getFullYear(), 0, 1);

        for (let year = first_year.getFullYear(); year <= last_year.getFullYear(); year++) {
            const d = new Date(year, 0, 1);
            ticks.push({ x: time_scale(d), d: d.getFullYear() });
        }
    }




    return ticks;
}

const calculate_ticks = () => {
    const start_date = time_scale.invert(svg_pos.start);
    const end_date = time_scale.invert(svg_pos.end);
    end_date.setHours(0,0,0,0);
    start_date.setHours(0,0,0,0);

    let ticks = [];
    const add_last_tick = (svg_pos.end < (-20 / svg_transform.k)) * 1;
    if (zoom_mode == zoom_modes.DAY) {
        let num_ticks = (end_date.getTime() - start_date.getTime()) / DAY_MILLIS + 1 + add_last_tick;
        
        // let color_i = Math.round(Math.abs(start_date.getTime()) / DAY_MILLIS) % 2;
        let idx = Math.round(Math.abs(start_date.getTime()) / DAY_MILLIS) % 8;
        for (let i = 0; i < num_ticks; i++) {
            idx = (idx+1) % 8;
            let color_idx = idx % 2;
            let d = new Date(start_date.getTime());
            d.setDate(d.getDate() + i);
            ticks.push({ 
                x: time_scale(d), 
                d: d.getDate(),
                i: idx,
                color_i: color_idx,
            });
        }
    } else if (zoom_mode == zoom_modes.MONTH) {
        start_date.setDate(1);
        end_date.setDate(1);
        const num_ticks = Math.round((end_date.getTime() - start_date.getTime()) / MONTH_MILLIS) + 1 + add_last_tick;

        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setMonth(d.getMonth() + i);
            let s = d.toDateString().substring(4, 7) + d.toDateString().substring(10) 
            ticks.push({ 
                x: time_scale(d), 
                d: d.toDateString().substring(4, 7),
                color_i: d.getMonth() % 2,
                i: d.getMonth() % 2,
            });
        }
    } else if (zoom_mode == zoom_modes.YEAR) {
        start_date.setDate(1);
        start_date.setMonth(0);
        end_date.setDate(1);
        end_date.setMonth(0);

        let num_ticks = Math.round((end_date.getTime() - start_date.getTime()) / YEAR_MILLIS) + 1 + add_last_tick;
        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setFullYear(d.getFullYear() + i);
            ticks.push({ 
                x: time_scale(d), 
                d: d.getFullYear(),
                color_i: d.getFullYear() % 2,
                i: d.getFullYear() % 2,
            });
        }
    } else if (zoom_mode == zoom_modes.DECADE) {
        start_date.setDate(1);
        start_date.setMonth(0);
        start_date.setFullYear(Math.floor(start_date.getFullYear()/10)*10);
        end_date.setDate(1);
        end_date.setMonth(0);
        end_date.setFullYear(Math.floor(end_date.getFullYear()/10)*10);

        let num_ticks = Math.round((end_date.getTime() - start_date.getTime()) / DECADE_MILLIS) + 1 + add_last_tick;
        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setFullYear(d.getFullYear() + 10*i);
            ticks.push({ 
                x: time_scale(d), 
                d: d.getFullYear(),
                color_i: d.getFullYear()/10 % 2,
                i: d.getFullYear()/10 % 2,
            });
        }
    } else if (zoom_mode == zoom_modes.CENTURY) {
        start_date.setDate(1);
        start_date.setMonth(0);
        start_date.setFullYear(Math.floor(start_date.getFullYear()/100)*100);
        end_date.setDate(1);
        end_date.setMonth(0);
        end_date.setFullYear(Math.floor(end_date.getFullYear()/100)*100);

        let num_ticks = Math.round((end_date.getTime() - start_date.getTime()) / DECADE_MILLIS) + 1 + add_last_tick;
        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setFullYear(d.getFullYear() + 100*i);
            ticks.push({ 
                x: time_scale(d), 
                d: d.getFullYear(),
                color_i: d.getFullYear()/100 % 2,
                i: d.getFullYear()/100 % 2,
            });
        }
    } else if (zoom_mode == zoom_modes.MILLENNIUM) {
        start_date.setDate(1);
        start_date.setMonth(0);
        start_date.setFullYear(Math.floor(start_date.getFullYear()/1000)*1000);
        end_date.setDate(1);
        end_date.setMonth(0);
        end_date.setFullYear(Math.floor(end_date.getFullYear()/1000)*1000);

        let num_ticks = Math.round((end_date.getTime() - start_date.getTime()) / DECADE_MILLIS) + 1 + add_last_tick;
        for (let i = 0; i < num_ticks; i++) {
            let d = new Date(start_date.getTime());
            d.setFullYear(d.getFullYear() + 1000*i);
            ticks.push({ 
                x: time_scale(d), 
                d: d.getFullYear(),
                color_i: d.getFullYear()/1000 % 2,
                i: d.getFullYear()/1000 % 2,
            });
        }
    }

    if (ticks.length > 25) {
        // console.log('[WARNING] Too many ticks');
        for (const tick of ticks) {
            tick.d = tick.i % 2 == 0 ? tick.d : '';
        }
    }
    return ticks;
};

const draw_ticks = (ticks) => {
    g.selectAll('rect.tick').remove();
    g.selectAll('text.tick').remove();

    g
        .append('rect')
        .attr('class', 'block')
        .attr('x', svg_pos.start)
        .attr('y', OPTIONS.main_row_y -2)
        .attr('width', svg_pos.end - svg_pos.start)
        .attr('height', 2)
        .style('fill', COLORS.axis);

    for (const tick of ticks) {
        const color = tick.d == '' ? '#BBB' : COLORS.tick;
        g
            .append('rect')
            .attr('class', 'tick')
            .attr('x', tick.x-2 / svg_transform.k)
            .attr('y', OPTIONS.main_row_y)
            .attr('width', 2 / svg_transform.k)
            .attr('height', 10)
            .style('fill', color);
        g
            .append('text')
            .attr('class', 'tick')
            .text(tick.d)
            .attr('x', (tick.x) * svg_transform.k)
            .attr('y', OPTIONS.main_row_y + OPTIONS.main_row_height/2 + 5)
            .attr('transform', `scale(${1/svg_transform.k},1)`)
            .attr('text-anchor', 'middle')
            .style('fill', COLORS.tick_text);
    }
}

// will be replaced by info on second row
const draw_year_ticks = (ticks) => {
    g.selectAll('rect.year_tick').remove();
    g.selectAll('text.year_tick').remove();
    for (const tick of ticks) {
        // g
        //     .append('rect')
        //     .attr('class', 'year_tick')
        //     .attr('x', tick.x-200 / svg_transform.k)
        //     .attr('y', OPTIONS.second_row_y+2)
        //     .attr('width', 400 / svg_transform.k)
        //     .attr('height', OPTIONS.second_row_height-4)
        //     .style('fill', 'url(#grad_second_sep)');

        // g
        //     .append('rect')
        //     .attr('class', 'year_tick')
        //     .attr('x', tick.x-1 / svg_transform.k)
        //     .attr('y', OPTIONS.second_row_y+2)
        //     .attr('width', 2 / svg_transform.k)
        //     .attr('height', OPTIONS.second_row_height-4)
        //     .style('fill', '#EEE');
        g
            .append('text')
            .attr('class', 'year_tick')
            .text(tick.d)
            .attr('x', (tick.x) * svg_transform.k +3)
            .attr('y', OPTIONS.second_row_y + OPTIONS.second_row_height/2 + 3)
            .attr('text-anchor', 'middle')
            .style('fill', '#777')
            .attr('font-weight', 'bold')
            .attr('transform', `scale(${1/svg_transform.k},1)`)
    }
}

const draw_blocks = (ticks) => {
    // console.log(ticks)
    g.selectAll('rect.block').remove();

    let updated_ticks = [...ticks]; 
    const last_tick = ticks[ticks.length-1]
    if (last_tick.x != svg_pos.end) {
        updated_ticks.push({ x: svg_pos.end, d: '', color_i: (last_tick.color_i +1) % 2 });
    }

    let last_block = svg_pos.start;
    

    for (const tick of updated_ticks) {
        const width = tick.x - last_block;
        const fill = tick.color_i ? 'url(#grad_main_dark)' :  'url(#grad_main_light)';
        g
            .append('rect')
            .attr('class', 'block')
            .attr('x', last_block)
            .attr('y', OPTIONS.main_row_y)
            .attr('width', width)
            .attr('height', OPTIONS.main_row_height)
            .style('fill', fill);
        g
            .append('rect')
            .attr('class', 'block')
            .attr('x', last_block)
            .attr('y', OPTIONS.second_row_y)
            .attr('width', width)
            .attr('height', 30)
            // .style('fill', 'url(#grad_main_dark)');
            .style('fill', COLORS.second_row);
        
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
x changing browser size should update svg
- first milestone: empty timeline with hour/day/month/year/century markings depending on zoom level
x update color scheme
- limits to svg width
    -> with block_width of 1 you can get about 22000 BCE
    -> distortion of text visible with block_width=10, min date: 300 BCE (day labels stop working much earlier)
    -> from 1000 BCE day zoom should be possible
    -> maybe use frame relative time_scale?
    -> for larger timespans only year is needed (no need for Date objects, just direct integers)
    -> 2 distinct svgs:
        1. from 1000 BCE: default
        2. before 1000 BCE or in millenium zoom and up: no more Date objects
- start view: last n years?
- smaller zoom modes: hours and minutes
- only remove/create stuff that moved in or out of window
- event -> date, title, description?, location?, tags?, color?, priority?
- make website responsive
    a. change font size accordingly
    b. width/height changes?
*/
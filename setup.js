let global_latest_time = moment();
let time_blocks = [];

$(function() {
    setup();
    initialize_datetime($('.datetime__div').first());
});

function setup(){
    get_existing_time_blocks();

}

function get_existing_time_blocks(){
    await $.ajax({
        url: '/api/get_existing_time_blocks',
        type: 'GET',
        dataType: 'json',
        success: function(data){
            data.array.forEach(element => {
                time_blocks.push(element);
            });
        }
    })

    return true;
}

function display_existing_time_blocks(){

    let html = '';
    time_blocks.forEach(element => {
        html += '<div class="time_block" id="time_block_' + element.id + '">';
        html += '<div class="time_block__student">' + element.student + '</div>';
        html += '<div class="time_block__starttime">' + element.starttime + '</div>';
        html += '<div class="time_block__endtime">' + element.endtime + '</div>';
        html += '<div class="time_block__actions">';
        if(element.student !== false){
            html += '<button class="btn btn-danger btn-sm cancel_time_block" data-id="' + element.id + '">Cancel</button>';
        }
        html += '<button class="btn btn-danger btn-sm delete_time_block" data-id="' + element.id + '">Delete</button></div>';
        html += '</div>';
        html += '</div>';
    });

    $('#existing_time_blocks').html(html);
}

function cancel_time_block(id){
    $.ajax({
        url: '/api/cancel_time_block',
        type: 'POST',
        dataType: 'json',
        data: {
            id: id
        },
        success: function(data){
            $('#time_block_' + id).find('div.time_block__student').text('Not selected');
            $('#time_block_' + id).find('button.cancel_time_block').remove();
        }
    })
}

function delete_time_block(id){
    $.ajax({
        url: '/api/delete_time_block',
        type: 'POST',
        dataType: 'json',
        data: {
            id: id
        },
        success: function(data){
            $('#time_block_' + id).remove();
            time_blocks.forEach(element => {
                if(element.id == id){
                    time_blocks.splice(time_blocks.indexOf(element), 1);
                }
            });
        }
    })
}

function add_datetime(){

    let last_datetime = $('.datetime__div').last();
    let new_datetime = last_datetime.clone();
    let new_length = $('.datetime__div').length + 1

    new_datetime.attr('id', 'datetime_' + new_length);
    new_datetime.find('h3').text('Date & Time ' + new_length);
    new_datetime.find('label.date_label').attr('for', 'date_' + new_length);
    new_datetime.find('label.starttime_label').attr('for', 'starttime_' + new_length);
    new_datetime.find('label.endtime_label').attr('for', 'endtime_' + new_length);
    
    new_datetime.find('input.date_input').attr('id', 'date_' + new_length).attr('name', 'date_' + new_length).val('');
    new_datetime.find('input.starttime_input').attr('id', 'starttime_' + new_length).attr('name', 'starttime_' + new_length).val('');
    new_datetime.find('input.endtime_input').attr('id', 'endtime_' + new_length).attr('name', 'endtime_' + new_length).val('');
    
    new_datetime.insertAfter(last_datetime);
    initialize_datetime($('.datetime__div').last());   // initialize the new datetime

}

function select_tab(obj){
    $('.tabs').find('li').removeClass('active');
    $(obj).parent().addClass('active');
    $('.tabs').find('div').removeClass('active');
    $('.tabs').find($(obj).attr('href')).addClass('active');
}

function update_total_time(){
    let total_time = 0;
    $('.datetime__span').each(function(){
        let time = $(this).text();
        if(time != ''){
            total_time += parseInt(time);
        }
    });
    $('#total_time').text('Total time: ' + total_time + ' minutes');
    
    update_total_time_blocks();
}

function update_total_time_blocks(){
    let total_time_blocks = 0;
    $('.datetime__span').each(function(){
        let time = $(this).text();
        if(time != ''){
            total_time_blocks += Math.ceil(parseInt(time) / parseInt($('#time_block_size').val()));
        }
    });
    $('#total_time_blocks').text('This will create ' + total_time_blocks + ' blocks of ' + $('#time_block_size').val() + ' minutes each.');
}

function initialize_datetime(datetime_elem){

    const now = moment();

    if(global_latest_time <= 22){
        global_latest_time = global_latest_time + moment.duration({hours:1});
    } else {
        global_latest_time = global_latest_time + moment.hours({hours:9});
    }

    $(datetime_elem).find('.date_input').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: global_latest_time,
        minDate: global_latest_time,
        maxDate: moment().add(1, 'years')
    });

    $(datetime_elem).find('.starttime_input').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: global_latest_time,
        minDate: moment().startOf('day'),
        maxDate: moment().add(1, 'hours')
    }).on('dp.hide', function(e){
        $(datetime_elem).find('.endtime_input').data('DateTimePicker').minDate(e.date.add(15, 'minute'));
        validate_time_fields(false);
    });

    $(datetime_elem).find('.endtime_input').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: global_latest_time + moment.duration({hours:1}),
        minDate: moment().subtract(1, 'hours'),
        maxDate: moment().endOf('day'),
    }).on('dp.hide', function(e){
        $(datetime_elem).find('.starttime_input').data('DateTimePicker').maxDate(e.date.subtract(15, 'minute'));
        validate_time_fields(false);
    });

    update_global_latest_time(global_latest_time);    

}

function update_global_latest_time(new_time){
    
    if(new_time == global_latest_time){
        if(global_latest_time.hours() <= 22){
            global_latest_time = global_latest_time + moment.duration({hours:1});
        } else {
            global_latest_time = global_latest_time + moment.hours({hours:9});
        }
    } else {
        if(new_time > global_latest_time){
            global_latest_time = new_time;
        }
    }
    
}

function error_message(message, id){
    
    if(typeof(id) == 'string')
        $('#' + id).addClass('error');
    else
        id.addClass('error');
    
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html(message);
    $('#messageModal').modal('show');

}

function clear_error_message(id){
    $('#' + id).removeClass('error');
}


function validate_time_fields(with_errors){
    valid = true;

    let datetimes = [];
    let total_time = 0;
    let total_blocks = 0;
    let time_block_size = 0;

    let latest_time = 0;

    let selected_tab = $('.tab-pane.active').find('label').attr('for');
    let block_value = parseInt($('#' + selected_tab).val());

    $('.datetime__div').each(function(){
        let datetime = {};
        let format = "YYYY-MM-DD hh:mm A";
        let date = $(this).find('.date_input').val() + " ";
        datetime['id'] = $(this).attr('id');
        datetime['start'] = moment(date + $(this).find('.starttime_input').val(), format);
        datetime['end'] = moment(date + $(this).find('.endtime_input').val(), format);
        datetimes.push(datetime);
    });

    datetimes.every(function(datetime1){
        if(datetime1['start'].isAfter(datetime1['end']) || datetime1['start'].isSame(datetime1['end'])){

            if(with_errors){
                error_message('Start time must be before end time.', $('#' + datetime1['id']).find('input'));
            }
            valid = false;
            return false;
        
        } else {
            let no_overlap = datetimes.every(function(datetime2){
                if(datetime1['id'] != datetime2['id'] && (
                    datetime1['start'].isAfter(datetime2['start']) && datetime1['start'].isBefore(datetime2['end']) || 
                    datetime1['end'].isAfter(datetime2['start']) && datetime1['end'].isBefore(datetime2['end']) ||
                    datetime1['start'].isSame(datetime2['start']) || datetime1['end'].isSame(datetime2['end']))){
                    
                    if(with_errors){
                        error_message('Datetimes must not overlap.', $('#' + datetime2['id']).find('input'));
                    }
                    valid = false;
                    return false;
                } else {
                    return true;
                }
            });

            if(no_overlap == false){
                return false;
            } else {

                if(datetime1['end'].isAfter(latest_time)){
                    latest_time = datetime1['end'];
                }
                return true;
            }
        }
    });

    if(block_value == ''){
        $('#' + selected_tab).addClass('error');
        valid = false;
        return false;
    }

}


function validate_all_fields(){

    $('input').removeClass('error');

    let valid = true;

    let title = $('#title').val();
    

    if(title == ''){
        $('#title').addClass('error');
        valid = false;
        return false;
    }
    
    validate_time_fields(true);

}
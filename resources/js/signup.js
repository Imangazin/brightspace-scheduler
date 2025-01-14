const params = new Proxy(new URLSearchParams(window.top.location.search), {get: (searchParams, prop) => searchParams.get(prop)});
let CFG = params.cfg;

let GROUP_CATEGORY_ID = null;
let TOPIC_ID = null;
let TITLE;
let MY_TIME = false;
let USER = whoAmI();
let MAX_STUDENTS = 1;
let CLASSLIST = getClassList('bas');
let COURSE;
let EXPIRED = false;
let REQUIRED_GROUP = false;
 
$(function(){init();});

async function init() {
    
    try {
        CFG = JSON.parse(atob(CFG));
        GROUP_CATEGORY_ID = CFG.gc;
        TOPIC_ID = CFG.t;        
    } catch(e) {
        console.log('Error parsing CFG: ' + e);
        return false;
    }

    let associated_groups = (CFG.agc !== undefined ? getGroupsInCategory(CFG.agc) : false);
    let myEnrollments = bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/');
    let orgInfo = bs.get('/d2l/api/lp/(version)/organization/info');
    const promises = await Promise.all([USER, CLASSLIST, myEnrollments, orgInfo, getGroupCategory(), getGroupsInCategory(), associated_groups]);
    USER = promises[0];
    CLASSLIST = promises[1];
    myEnrollments = promises[2];
    orgInfo = promises[3];
    let groupCategory = promises[4];
    let groups = promises[5];
    associated_groups = promises[6];
    
    let timeZone = orgInfo.TimeZone;
    moment.tz.setDefault(timeZone);

    for(item of myEnrollments.Items){
        if(item.OrgUnit.Type.Id == 3 && item.OrgUnit.Id == ORG_UNIT_ID){
            COURSE = item.OrgUnit;
            break;
        }
    }

    TITLE = groupCategory.Name;
    $('#schedule_title').html(TITLE);

    if(groupCategory.SelfEnrollmentExpiryDate != null){
        $('#expiry_date').html("Last day to sign up: " + moment.utc(groupCategory.SelfEnrollmentExpiryDate, 'YYYY-MM-DDTHH:mm:ss.fffZ').subtract(1, 'days').tz(timeZone).format('MMM Do, YYYY'));
        $('#expiry_date').show();
    }

    if(groupCategory.Description.Text != ''){
        $('#schedule_description').html(groupCategory.Description.Text.replace('\n', '<br />'));
        $('#schedule_description').show();
    } else if(groupCategory.Description.Html != '') {
        $('#schedule_description').html(groupCategory.Description.Html);
        $('#schedule_description').show();
    }
    MAX_STUDENTS = groupCategory.MaxUsersPerGroup;
    
    if(moment() > moment.utc(groupCategory.SelfEnrollmentExpiryDate, 'YYYY-MM-DDTHH:mm:ss.fffZ')){
        EXPIRED = true;
    }

    let availableGroups = await displayGroupsInCategory(groups);

    if(MY_TIME !== false){
        $('#my_selection__content').html('<h3>' + MY_TIME.name + '</h3>');
        
        if(!EXPIRED){
            $('#my_selection__content').append('<p><button class="btn btn-secondary btn-sm cancel-timeslot" id="cancel-selection">Cancel my selection</button></p>');
            $('#cancel-selection').on('click', function(){
                modalConfirm('Are you sure you cancel this registration?<br />You will lose this time slot and you will need to select a new one.',
                    cancelMySelection);
            });
        }
        $('#my_selection').show();
    } else {
        if(CFG.rt !== undefined && associated_groups !== false){
            findRequiredGroup(groups, associated_groups);
        }
    }
}

async function displayGroupsInCategory(groups){
    
    let availableGroups = 0;
    let html = '<tr>' + (MAX_STUDENTS > 1 ? '<th>Enrollment</th>' : '') + '<th>Date & Time</th>' + (EXPIRED ? '' : '<th class="student_timeslot_actions">Actions</th>') + '</tr>';

    $('#existing_timeslots__table').html(html);

    const results = await Promise.all([CLASSLIST, USER]);
    CLASSLIST = results[0];
    USER = results[1];

    for(let group of groups){
        
        if(group.Enrollments.length < MAX_STUDENTS && !group.Enrollments.includes(USER.Identifier)){

            availableGroups++;

            html = '<tr class="timeslot" id="timeslot_' + group.GroupId + '">';
            if(MAX_STUDENTS > 1){
                html += '<td class="timeslot_datetime">' + group.Enrollments.length + '/' + MAX_STUDENTS + ' students';
                if(group.Enrollments.length > 0){
                    html += '<br><small>';
                    for(let student of group.Enrollments){
                        html += CLASSLIST[student].DisplayName + '<br>';
                    }
                    html += '</small>';
                }
                html += '</td>';
            }
            html += '<td class="timeslot_datetime">' + group.Name + '</td>';
            if(!EXPIRED){
                html += '<td class="timeslot_actions student_timeslot_actions">';
                html += '<button class="btn btn-secondary btn-sm select-timeslot" data-id="' + group.GroupId + '">Select this time</button>';
                html += '</td>';
            }
            html += '</tr>';

            $('#existing_timeslots__table').append(html);
            $('#timeslot_' + group.GroupId).find('.select-timeslot').on('click', function(){
                modalConfirm('Are you sure you want to select:<br />' + group.Name, 
                    function(){
                        $('.select-timeslot').prop('disabled', true);
                        selectTimeSlot(group);
                    }
                );
            });
        } else if (group.Enrollments.includes(USER.Identifier)){
            MY_TIME = {
                name: group.Name,
                groupId: group.GroupId,
                student: USER.Identifier
            }
        }
    }
    
    if(MY_TIME === false){
        $('.student_timeslot_actions').show();
    } else {
        $('.student_timeslot_actions').remove();
    }
    
    if(EXPIRED){
        $('#existing_timeslots__heading').html('Sign up is now closed.').after('<p>If you still need to sign up, please contact your instructor.</p>');
    } else if(availableGroups == 0){
        $('#existing_timeslots__heading').html('No additional time slots are available');
        $('#existing_timeslots__table').remove();
    } else if(MY_TIME !== false){
        $('#existing_timeslots__heading').html('Other available time slots');
    } else {
        $('#existing_timeslots__heading').html('Available time slots');
    }

    $('#existing_timeslots').show();

    return availableGroups;

}

function findRequiredGroup(groups, associated_groups){
    if(CFG.rt == 1){

        // find the associated group user is regisrered in
        for(const ag of associated_groups){
            if(ag.Enrollments.includes(USER.Identifier)){

                // find the timeslot group other members of the associated group are registered in
                for(const group of groups){
                    for(const student of ag.Enrollments){
                        if(group.Enrollments.includes(student)){

                            REQUIRED_GROUP = group;

                            // register the uesr in the same timeslot
                            modalMessage('One of your group members has already registered for a time slot:<br />' + group.Name + 
                                '<br />You will be automatically registered for the same time slot.', null, function(){selectTimeSlot(group)});

                            return false;
                        }
                    }
                }
            }
        }
    }
}

async function cancelMySelection(){
    if(MY_TIME === false){
        return false;
    }

    $('#cancel-selection').remove();
    let unenroll = unenrollFromGroup(MY_TIME.groupId);
    //let sendEmail = notifyOfCancellation();
    //await Promise.all([unenroll, sendEmail]);
    await Promise.all([unenroll]);
    MY_TIME = false;

    window.location.reload();
}

async function selectTimeSlot(group){
    if(MY_TIME !== false || EXPIRED || group.Enrollments.length >= MAX_STUDENTS || (REQUIRED_GROUP !== false && group.GroupId != REQUIRED_GROUP.GroupId)){
        return false;
    }

    let classList = getClassList('bas');

    let data = {
        "d2l_rf": "IsGroupFull",
        "params": "{\"param1\":" + group.GroupId + "}",
        "d2l_action": "rpc"
    };
    let isFull = await bs.submit('/d2l/lms/group/user_available_group_list.d2lfile?ou=(orgUnitId)&d2l_rh=rpc&d2l_rt=call',data);
    
    if(isFull.Result === true){
        modalMessage('This time slot is full. Please select another time slot.<br />Reload the page to see the updated list of available time slots.');
        $('#timeslot_' + group.GroupId).remove();
        return false;
    }

    let enroll = enrollInGroup(group.GroupId);

    let host = window.top.location.host;

    let calendarSubscription = await bs.get('/d2l/le/calendar/(orgUnitId)/subscribe/subscribeDialogLaunch?subscriptionOptionId=-1');
    let feedToken = calendarSubscription.match(/feed\.ics\?token\=([a-zA-Z0-9]+)/)[1];
    let feedUrl = '<p>You can add your Brightspace calendar to your favourite calendar app with this URL:</p>' +
                  '<pre>webcal://' + host + '/d2l/le/calendar/feed/user/feed.ics?token=' + feedToken + '</pre>';
    let calendarUrl = 'https://' + host + '/d2l/le/calendar/' + ORG_UNIT_ID;
    let topicUrl = 'https://' + host + '/d2l/le/content/' + ORG_UNIT_ID + '/viewContent/' + TOPIC_ID + '/View';

    let pluginPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));

    let subject = 'Brightspace Scheduling: Your time slot is confirmed';

    result = await fetch(pluginPath + '/resources/html/emailstudentenrolled.tpl');
    body = await result.text();

    body = body.replace(/\(courseName\)/g, COURSE.Name);
    body = body.replace(/\(scheduleTitle\)/g, TITLE);
    body = body.replace(/\(timeSlot\)/g, group.Name);
    body = body.replace(/\(feedUrl\)/g, feedUrl);
    body = body.replace(/\(topicUrl\)/g, topicUrl);
    body = body.replace(/\(calendarUrl\)/g, calendarUrl);

    classList = await classList;
    
    let studentEmail = classList[USER.Identifier].Email;
    //let email = sendEmail(studentEmail, subject, body);
    //await Promise.all([enroll, email]);
    await Promise.all([enroll);
    window.location.reload();
}

function enrollInGroup(groupId){
    // api doesn't let learners enroll themselves, form must be used instead
    let data = {
        "d2l_rf": "EnrollUser",
        "params": "{\"param1\":" + groupId + "}",
        "d2l_action": "rpc"
    };
    return bs.submit('/d2l/lms/group/user_available_group_list.d2lfile?ou=(orgUnitId)&d2l_rh=rpc&d2l_rt=call', data);
}

async function notifyOfCancellation(){
    let classList = getClassList('bas');
    
    let pluginPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));
    let result = await fetch(pluginPath + '/resources/html/emailstudentcancelled.tpl');
    let body = await result.text();

    classList = await classList;
    
    let studentEmail = classList[USER.Identifier].Email;
    let subject = 'Brightspace Scheduling: Your time slot was cancelled';
    let topicUrl = 'https://' + window.top.location.host + '/d2l/le/content/' + ORG_UNIT_ID + '/viewContent/' + TOPIC_ID + '/View';
    
    body = body.replace(/\(courseName\)/g, COURSE.Name);
    body = body.replace(/\(scheduleTitle\)/g, TITLE);
    body = body.replace(/\(topicUrl\)/g, topicUrl);
    
    return sendEmail(studentEmail, subject, body);
}


function unenrollFromGroup(groupId){
    // api doesn't let learners unenroll themselves, form must be used instead
    let data = {
        "d2l_rf": "UnenrollUser",
        "params": "{\"param1\":" + groupId + "}",
        "d2l_action": "rpc"
    };
    return bs.submit('/d2l/lms/group/user_group_list.d2lfile?ou=(orgUnitId)&d2l_rh=rpc&d2l_rt=call', data);
}

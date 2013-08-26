/*jslint indent: 2, maxlen: 80, sloppy: true, nomen: true, unparam: true */
/*global arrayInsert, indexOf, deepClone, defaults */

// creates
// - some defaults job rule actions

function enableJobChecker(jio, shared, options) {

  // dependencies
  // - shared.jobs Object Array

  // creates
  // - shared.job_rules Array

  // uses 'job' events

  var i;

  shared.job_rule_action_names = [undefined, "ok", "wait", "update", "deny"];

  shared.job_rule_actions = {
    wait: function (original_job, new_job) {
      // XXX
      return;
    },
    update: function (original_job, new_job) {
      if (!new_job.deferred) {
        // promise associated to the job
        new_job.state = 'done';
        shared.emit('jobDone', new_job);
      } else {
        if (!original_job.deferred) {
          original_job.deferred = new_job.deferred;
        } else {
          original_job.deferred.promise().
            done(new_job.command.resolve).
            fail(new_job.command.reject);
        }
      }
      new_job.state = 'running';
    },
    deny: function (original_job, new_job) {
      // XXX
      return;
    }
  };

  function addJobRule(job_rule) {
    var i, old_position, before_position, after_position;
    // job_rule = {
    //   code_name: string
    //   conditions: [string, ...]
    //   action: 'wait',
    //   after: code_name
    //   before: code_name
    // }
    if (typeof job_rule !== 'object' || job_rule === null) {
      // wrong job rule
      return;
    }
    if (typeof job_rule.code_name !== 'string') {
      // wrong code name
      return;
    }
    if (!Array.isArray(job_rule.conditions)) {
      // wrong conditions
      return;
    }
    if (indexOf(job_rule.action, shared.job_rule_action_names) === -1) {
      // wrong action
      return;
    }

    if (typeof job_rule.after !== 'string') {
      job_rule.after = '';
    }
    if (typeof job_rule.before !== 'string') {
      job_rule.before = '';
    }

    for (i = 0; i < shared.job_rules.length; i += 1) {
      if (shared.job_rules[i].code_name === job_rule.after) {
        after_position = i + 1;
      }
      if (shared.job_rules[i].code_name === job_rule.before) {
        before_position = i;
      }
      if (shared.job_rules[i].code_name === job_rule.code_name) {
        old_position = i;
      }
    }

    job_rule = {
      "code_name": job_rule.code_name,
      "conditions": job_rule.conditions,
      "action": job_rule.action || "ok"
    };

    if (before_position === undefined) {
      before_position = shared.job_rules.length;
    }
    if (after_position > before_position) {
      before_position = undefined;
    }
    if (job_rule.action !== "ok" && before_position !== undefined) {
      arrayInsert(shared.job_rules, before_position, job_rule);
    }
    if (old_position !== undefined) {
      if (old_position >= before_position) {
        old_position += 1;
      }
      shared.job_rules.splice(old_position, 1);
    }
  }

  function jobsRespectConditions(original_job, new_job, conditions) {
    var j;
    // browsing conditions
    for (j = 0; j < conditions.length; j += 1) {
      if (defaults.job_rule_conditions[conditions[j]]) {
        if (
          !defaults.job_rule_conditions[conditions[j]](original_job, new_job)
        ) {
          return false;
        }
      }
    }
    return true;
  }

  function checkJob(job) {
    var i, j;
    if (job.state === 'ready') {
      // browsing rules
      for (i = 0; i < shared.job_rules.length; i += 1) {
        // browsing jobs
        for (j = 0; j < shared.jobs.length; j += 1) {
          if (shared.jobs[j] !== job) {
            if (
              jobsRespectConditions(
                shared.jobs[j],
                job,
                shared.job_rules[i].conditions
              )
            ) {
              shared.job_rule_actions[shared.job_rules[i].action](
                shared.jobs[j],
                job
              );
              return;
            }
          }
        }
      }
    }
  }

  if (options.job_management !== false) {

    shared.job_rules = [{
      "code_name": "readers update",
      "conditions": [
        "sameStorageDescription",
        "areReaders",
        "sameMethod",
        "sameParameters",
        "sameOptions"
      ],
      "action": "update"
    }, {
      "code_name": "writers update",
      "conditions": [
        "sameStorageDescription",
        "areWriters",
        "sameMethod",
        "sameParameters"
      ],
      "action": "update"
    }, {
      "code_name": "writers wait",
      "conditions": [
        "sameStorageDescription",
        "areWriters",
        "sameDocumentId"
      ],
      "action": "wait"
    }];

    if (Array.isArray(options.job_rules)) {
      for (i = 0; i < options.job_rules.length; i += 1) {
        addJobRule(deepClone(options.job_rules[i]));
      }
    }

    shared.on('job', checkJob);

  }

  jio.jobRules = function () {
    return deepClone(shared.job_rules);
  };
}
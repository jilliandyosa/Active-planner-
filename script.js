"use strict";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function dateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function readableDate(
  value,
  options = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
) {
  if (!value) return "";

  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, options);
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

// ==========================================
// COLOR HELPER
// ==========================================

function shadeColor(color, percent) {
  const number = parseInt(color.replace("#", ""), 16);

  const amount = Math.round(2.55 * percent);

  const red = Math.max(0, Math.min(255, (number >> 16) + amount));
  const green = Math.max(0, Math.min(255, ((number >> 8) & 0xff) + amount));
  const blue = Math.max(0, Math.min(255, (number & 0xff) + amount));

  return (
    "#" +
    [red, green, blue]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  );
}

// ==========================================
// CLASS 1: TASK
// ==========================================

class Task {
  constructor({
    id = crypto.randomUUID(),
    title,
    dueDate,
    priority = "Medium",
    completed = false,
    alert = false,
    alertTime = "09:00",
    alerted = false,
  }) {
    this.id = id;
    this.title = title;
    this.dueDate = dueDate;
    this.priority = priority;
    this.completed = completed;
    this.alert = alert;
    this.alertTime = alertTime;
    this.alerted = alerted;
  }

  toggleComplete() {
    this.completed = !this.completed;
  }

  toggleAlert() {
    this.alert = !this.alert;
    this.alerted = false;
  }
}

// ==========================================
// CLASS 2: SCHEDULE ITEM
// ==========================================

class ScheduleItem {
  constructor({ id = crypto.randomUUID(), title, date, time }) {
    this.id = id;
    this.title = title;
    this.date = date;
    this.time = time;
  }
}

// ==========================================
// CLASS 3: PLANNER
// ==========================================

class Planner {
  constructor() {
    const saved = this.load();

    this.tasks = (saved.tasks || []).map((item) => new Task(item));

    this.schedules = (saved.schedules || []).map(
      (item) => new ScheduleItem(item),
    );

    // Always provide default appearance settings
    this.settings = {
      color: saved.settings?.color || "#ec4899",
      font: saved.settings?.font || "'DM Sans', sans-serif",
    };
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem("activePlannerData")) || {};
    } catch {
      return {};
    }
  }

  save() {
    localStorage.setItem(
      "activePlannerData",
      JSON.stringify({
        tasks: this.tasks,
        schedules: this.schedules,
        settings: this.settings,
      }),
    );
  }

  addTask(taskData) {
    const task = new Task(taskData);
    this.tasks.push(task);
    this.save();

    return task;
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter((task) => task.id !== id);

    this.save();
  }

  findTask(id) {
    return this.tasks.find((task) => task.id === id);
  }

  addSchedule(data) {
    const item = new ScheduleItem(data);
    this.schedules.push(item);
    this.save();

    return item;
  }

  deleteSchedule(id) {
    this.schedules = this.schedules.filter((item) => item.id !== id);

    this.save();
  }

  get pendingTasks() {
    return this.tasks.filter((task) => !task.completed);
  }

  get completedTasks() {
    return this.tasks.filter((task) => task.completed);
  }

  get tasksWithAlerts() {
    return this.tasks.filter((task) => task.alert);
  }
}

// Create Planner object
const planner = new Planner();

// ==========================================
// GLOBAL VARIABLES
// ==========================================

let currentView = "dashboard";
let taskFilter = "all";

let calendarMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
);

let selectedCalendarDate = dateString();
let toastTimer;

// ==========================================
// TOAST MESSAGE
// ==========================================

function showToast(message) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// ==========================================
// APPEARANCE CUSTOMIZATION
// ==========================================

function applySettings() {
  const color = planner.settings.color;
  const font = planner.settings.font;

  // Apply theme color
  document.documentElement.style.setProperty("--accent", color);

  document.documentElement.style.setProperty(
    "--accent-dark",
    shadeColor(color, -12),
  );

  document.documentElement.style.setProperty("--accent-soft", `${color}22`);

  document.documentElement.style.setProperty("--accent-pale", `${color}0d`);

  // Apply font throughout the website
  document.documentElement.style.setProperty("--font", font);

  document.body.style.fontFamily = font;

  // Highlight selected color
  $$(".swatch").forEach((button) => {
    button.classList.toggle("active", button.dataset.color === color);
  });

  // Update font dropdown
  const fontSelect = $("#fontSelect");

  if (fontSelect) {
    fontSelect.value = font;
  }
}

// ==========================================
// NAVIGATION
// ==========================================

function navigate(view) {
  if (!$("#view-" + view)) return;

  currentView = view;

  $$(".view").forEach((section) => {
    section.classList.toggle("active-view", section.id === `view-${view}`);
  });

  $$(".nav-item, .mobile-nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  if (view === "calendar") {
    renderCalendar();
  }

  if (view === "schedule") {
    renderSchedule();
  }

  if (view === "settings") {
    applySettings();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// ==========================================
// TASK ROW HTML
// ==========================================

function taskRow(task, options = {}) {
  const dateLabel = task.dueDate
    ? `Due ${readableDate(task.dueDate, {
        month: "short",
        day: "numeric",
      })}`
    : "No due date";

  return `
    <div class="task-row ${task.completed ? "completed" : ""}">

      <input
        class="check-task"
        type="checkbox"
        data-action="toggle-task"
        data-id="${task.id}"
        ${task.completed ? "checked" : ""}
        aria-label="Mark ${escapeHTML(task.title)} complete"
      >

      <div class="task-main">
        <span class="task-title">
          ${escapeHTML(task.title)}
        </span>

        <span class="task-meta">
          ${dateLabel}
          ${task.alert ? " · Alert on" : ""}
        </span>
      </div>

      <span class="priority-pill ${task.priority.toLowerCase()}">
        ${escapeHTML(task.priority)}
      </span>

      ${
        options.reminder
          ? `
          <button
            class="small-action"
            data-action="toggle-alert"
            data-id="${task.id}"
            title="Turn alert off"
          >
            🔔
          </button>
        `
          : ""
      }

      <button
        class="small-action"
        data-action="delete-task"
        data-id="${task.id}"
        title="Delete task"
        aria-label="Delete task"
      >
        ×
      </button>

    </div>
  `;
}

function empty(message) {
  return `
    <div class="empty-state">
      ${message}
    </div>
  `;
}

// ==========================================
// DASHBOARD
// ==========================================

function renderDashboard() {
  const now = new Date();

  $("#greeting").textContent = `${
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening"
  }! 💗`;

  $("#statTotal").textContent = planner.tasks.length;
  $("#statPending").textContent = planner.pendingTasks.length;
  $("#statDone").textContent = planner.completedTasks.length;
  $("#statReminders").textContent = planner.tasksWithAlerts.length;

  const todays = planner.tasks.filter((task) => task.dueDate === dateString());

  $("#dashboardTasks").innerHTML = todays.length
    ? todays
        .slice(0, 5)
        .map((task) => taskRow(task))
        .join("")
    : empty("No tasks due today. Enjoy the breathing room!");

  const upcoming = [...planner.schedules]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .filter((schedule) => schedule.date >= dateString())
    .slice(0, 5);

  $("#dashboardAgenda").innerHTML = upcoming.length
    ? upcoming
        .map(
          (schedule) => `
            <div class="agenda-item">
              <div class="agenda-time">
                ${escapeHTML(schedule.time)}
              </div>

              <div>
                <div class="agenda-title">
                  ${escapeHTML(schedule.title)}
                </div>

                <div class="agenda-date">
                  ${readableDate(schedule.date, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
          `,
        )
        .join("")
    : empty("No upcoming activities yet.");
}

// ==========================================
// TO-DO LIST
// ==========================================

function renderTasks() {
  let list = planner.tasks;

  if (taskFilter === "active") {
    list = list.filter((task) => !task.completed);
  }

  if (taskFilter === "completed") {
    list = list.filter((task) => task.completed);
  }

  list = [...list].sort((a, b) =>
    (a.dueDate || "").localeCompare(b.dueDate || ""),
  );

  $("#todoList").innerHTML = list.length
    ? list
        .map((task) =>
          taskRow(task, {
            reminder: true,
          }),
        )
        .join("")
    : empty("Nothing here yet. Add a task to get started.");

  $("#taskCount").textContent =
    `${list.length} ${list.length === 1 ? "task" : "tasks"}`;
}

// ==========================================
// DAILY SCHEDULE
// ==========================================

function renderSchedule() {
  const date = $("#agendaDate").value || dateString();

  const items = planner.schedules
    .filter((schedule) => schedule.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));

  $("#scheduleList").innerHTML = items.length
    ? items
        .map(
          (item) => `
            <div class="timeline-item">

              <div class="timeline-time">
                ${escapeHTML(item.time)}
              </div>

              <div class="timeline-marker"></div>

              <div class="timeline-content">
                <div>
                  <strong>
                    ${escapeHTML(item.title)}
                  </strong>

                  <small>
                    ${readableDate(item.date)}
                  </small>
                </div>

                <button
                  class="small-action"
                  data-action="delete-schedule"
                  data-id="${item.id}"
                  aria-label="Delete activity"
                >
                  ×
                </button>
              </div>
            </div>
          `,
        )
        .join("")
    : empty("No activities planned for this date.");
}

// ==========================================
// TASK ORGANIZER
// ==========================================

function renderOrganizer() {
  ["High", "Medium", "Low"].forEach((priority) => {
    const items = planner.tasks.filter(
      (task) => task.priority === priority && !task.completed,
    );

    $(`#${priority.toLowerCase()}Tasks`).innerHTML = items.length
      ? items.map((task) => taskRow(task)).join("")
      : empty(`No ${priority.toLowerCase()} priority tasks.`);
  });
}

// ==========================================
// REMINDERS
// ==========================================

function renderReminders() {
  const items = [...planner.tasksWithAlerts].sort((a, b) =>
    (a.dueDate + a.alertTime).localeCompare(b.dueDate + b.alertTime),
  );

  $("#reminderList").innerHTML = items.length
    ? items
        .map(
          (task) => `
            <div class="task-row ${task.completed ? "completed" : ""}">

              <span class="stat-icon pink-icon" style="margin:0">
                ♧
              </span>

              <div class="task-main">
                <span class="task-title">
                  ${escapeHTML(task.title)}
                </span>

                <span class="task-meta">
                  ${readableDate(task.dueDate)}
                  · ${escapeHTML(task.alertTime)}
                  · ${task.completed ? "Completed" : "Pending"}
                </span>
              </div>

              <button
                class="small-action"
                data-action="toggle-alert"
                data-id="${task.id}"
                title="Turn off alert"
              >
                Turn off
              </button>

            </div>
          `,
        )
        .join("")
    : empty("No active reminders. Turn on an alert when adding a task.");
}

// ==========================================
// CALENDAR
// ==========================================

function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  $("#monthLabel").textContent = calendarMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousDays = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = 0; i < 42; i++) {
    let day;
    let cellDate;
    let outside = false;

    if (i < firstDay) {
      day = previousDays - firstDay + i + 1;
      cellDate = dateString(new Date(year, month - 1, day));
      outside = true;
    } else if (i >= firstDay + daysInMonth) {
      day = i - firstDay - daysInMonth + 1;
      cellDate = dateString(new Date(year, month + 1, day));
      outside = true;
    } else {
      day = i - firstDay + 1;
      cellDate = dateString(new Date(year, month, day));
    }

    const hasTask = planner.tasks.some((task) => task.dueDate === cellDate);

    const hasSchedule = planner.schedules.some(
      (schedule) => schedule.date === cellDate,
    );

    cells.push(`
      <button
        class="calendar-day
        ${outside ? "outside" : ""}
        ${cellDate === dateString() ? "today" : ""}
        ${cellDate === selectedCalendarDate ? "selected" : ""}"
        data-date="${cellDate}"
      >
        <span class="day-number">${day}</span>

        <span class="day-dots">
          ${hasTask ? "<i></i>" : ""}
          ${hasSchedule ? '<i class="schedule-dot"></i>' : ""}
        </span>
      </button>
    `);
  }

  $("#calendarDays").innerHTML = cells.join("");

  renderSelectedDate();
}

// ==========================================
// SELECTED CALENDAR DATE
// ==========================================

function renderSelectedDate() {
  $("#selectedDateLabel").textContent = readableDate(selectedCalendarDate, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const tasks = planner.tasks
    .filter((task) => task.dueDate === selectedCalendarDate)
    .map((task) => taskRow(task));

  const schedules = planner.schedules
    .filter((schedule) => schedule.date === selectedCalendarDate)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(
      (schedule) => `
        <div class="agenda-item">
          <div class="agenda-time">
            ${escapeHTML(schedule.time)}
          </div>

          <div class="agenda-title">
            ${escapeHTML(schedule.title)}
          </div>
        </div>
      `,
    );

  const all = [...tasks, ...schedules];

  $("#selectedDateItems").innerHTML = all.length
    ? all.join("")
    : empty("Nothing planned for this day.");
}

// ==========================================
// RENDER ALL SECTIONS
// ==========================================

function renderAll() {
  renderDashboard();
  renderTasks();
  renderSchedule();
  renderOrganizer();
  renderReminders();

  if (currentView === "calendar") {
    renderCalendar();
  }
}

// ==========================================
// WELCOME SCREEN
// ==========================================

$("#startButton").addEventListener("click", () => {
  $("#welcomeScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");

  renderAll();
});

// ==========================================
// NAVIGATION AND BUTTON ACTIONS
// ==========================================

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-view]");

  if (nav) {
    event.preventDefault();
    navigate(nav.dataset.view);
  }

  const action = event.target.closest("[data-action]");

  if (!action) return;

  const { id } = action.dataset;

  if (action.dataset.action === "toggle-task") {
    const task = planner.findTask(id);

    if (task) {
      task.toggleComplete();
      planner.save();
      renderAll();
    }
  }

  if (action.dataset.action === "delete-task") {
    if (confirm("Delete this task?")) {
      planner.deleteTask(id);
      renderAll();
      showToast("Task deleted.");
    }
  }

  if (action.dataset.action === "toggle-alert") {
    const task = planner.findTask(id);

    if (task) {
      task.toggleAlert();
      planner.save();
      renderAll();

      showToast(task.alert ? "Reminder turned on." : "Reminder turned off.");
    }
  }

  if (action.dataset.action === "delete-schedule") {
    planner.deleteSchedule(id);
    renderAll();
    showToast("Activity deleted.");
  }
});

// ==========================================
// ADD NEW TASK
// ==========================================

$("#taskForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const title = $("#taskTitle").value.trim();

  if (!title) return;

  planner.addTask({
    title,
    dueDate: $("#taskDate").value,
    priority: $("#taskPriority").value,
    alert: $("#taskAlert").value === "yes",
    alertTime: $("#taskAlertTime").value,
  });

  event.target.reset();

  $("#taskDate").value = dateString();
  $("#taskAlertTime").value = "09:00";

  renderAll();
  showToast("Task added successfully.");
});

// ==========================================
// ADD NEW SCHEDULE
// ==========================================

$("#scheduleForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const title = $("#scheduleTitle").value.trim();

  if (!title) return;

  planner.addSchedule({
    title,
    date: $("#scheduleDate").value,
    time: $("#scheduleTime").value,
  });

  event.target.reset();

  $("#scheduleDate").value = dateString();

  renderAll();
  showToast("Activity added to your schedule.");
});

// ==========================================
// TASK FILTERS
// ==========================================

$("#taskFilters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");

  if (!button) return;

  taskFilter = button.dataset.filter;

  $$(".filter-btn").forEach((b) => {
    b.classList.toggle("selected", b === button);
  });

  renderTasks();
});

// ==========================================
// SCHEDULE DATE FILTER
// ==========================================

$("#agendaDate").addEventListener("change", () => {
  renderSchedule();
});

// ==========================================
// CALENDAR NAVIGATION
// ==========================================

$("#prevMonth").addEventListener("click", () => {
  calendarMonth.setMonth(calendarMonth.getMonth() - 1);
  renderCalendar();
});

$("#nextMonth").addEventListener("click", () => {
  calendarMonth.setMonth(calendarMonth.getMonth() + 1);
  renderCalendar();
});

$("#todayButton").addEventListener("click", () => {
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  selectedCalendarDate = dateString();

  renderCalendar();
});

$("#calendarDays").addEventListener("click", (event) => {
  const day = event.target.closest("[data-date]");

  if (!day) return;

  selectedCalendarDate = day.dataset.date;

  calendarMonth = new Date(`${selectedCalendarDate}T12:00:00`);

  calendarMonth.setDate(1);

  renderCalendar();
});

// ==========================================
// CHANGE THEME COLOR
// ==========================================

$$(".swatch").forEach((button) => {
  button.addEventListener("click", () => {
    planner.settings.color = button.dataset.color;

    planner.save();
    applySettings();

    showToast("Theme color changed! 💗");
  });
});

// ==========================================
// CHANGE FONT STYLE
// ==========================================

const fontSelect = $("#fontSelect");

if (fontSelect) {
  fontSelect.addEventListener("change", (event) => {
    planner.settings.font = event.target.value;

    planner.save();
    applySettings();

    showToast("Font changed successfully! 💗");
  });
}

// ==========================================
// RESET APPEARANCE
// ==========================================

$("#resetAppearance").addEventListener("click", () => {
  planner.settings = {
    color: "#ec4899",
    font: "'DM Sans', sans-serif",
  };

  planner.save();
  applySettings();

  showToast("Appearance reset.");
});

// ==========================================
// REMINDER SYSTEM
// ==========================================

let lastAlertKey = "";

function checkReminders() {
  const now = new Date();
  const today = dateString();

  const currentTime =
    `${String(now.getHours()).padStart(2, "0")}:` +
    `${String(now.getMinutes()).padStart(2, "0")}`;

  const due = planner.tasksWithAlerts.filter(
    (task) =>
      !task.completed &&
      task.dueDate === today &&
      task.alertTime <= currentTime &&
      !task.alerted,
  );

  due.forEach((task) => {
    const key = `${task.id}-${today}`;

    if (key === lastAlertKey) return;

    lastAlertKey = key;

    task.alerted = true;
    planner.save();

    $("#alertTitle").textContent = task.title;

    $("#alertMessage").textContent =
      `This task is due today. Your reminder time was ${task.alertTime}.`;

    $("#alertModal").classList.remove("hidden");

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Active Planner reminder", {
        body: task.title,
      });
    }
  });
}

// ==========================================
// CLOSE REMINDER ALERT
// ==========================================

$("#dismissAlert").addEventListener("click", () => {
  $("#alertModal").classList.add("hidden");
});

$("#alertModal").addEventListener("click", (event) => {
  if (event.target.id === "alertModal") {
    $("#alertModal").classList.add("hidden");
  }
});

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

function initialize() {
  const today = dateString();

  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  ["#taskDate", "#scheduleDate", "#agendaDate"].forEach((selector) => {
    $(selector).value = today;
  });

  applySettings();
  renderAll();

  setInterval(checkReminders, 15000);
}

// Start application
initialize();

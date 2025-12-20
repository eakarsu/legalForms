const fs = require('fs');
const path = require('path');

const fullNav = `    <nav class="navbar navbar-expand-lg navbar-dark pm-navbar">
        <div class="container-fluid">
            <a class="navbar-brand d-flex align-items-center" href="/clients">
                <div class="brand-icon me-2"><i class="fas fa-balance-scale"></i></div>
                <span class="brand-text">LegalForms<span class="text-info">AI</span></span>
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#pmNavbar">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="pmNavbar">
                <ul class="navbar-nav me-auto">
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown"><i class="fas fa-users me-1"></i>Clients</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/clients"><i class="fas fa-list me-2"></i>All Clients</a></li>
                            <li><a class="dropdown-item" href="/clients/new"><i class="fas fa-plus me-2"></i>Add Client</a></li>
                        </ul>
                    </li>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown"><i class="fas fa-briefcase me-1"></i>Cases</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/cases"><i class="fas fa-list me-2"></i>All Cases</a></li>
                            <li><a class="dropdown-item" href="/cases/new"><i class="fas fa-plus me-2"></i>New Case</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="/deadlines"><i class="fas fa-exclamation-circle me-2"></i>Deadlines</a></li>
                        </ul>
                    </li>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown"><i class="fas fa-calendar-alt me-1"></i>Calendar</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/calendar"><i class="fas fa-calendar me-2"></i>Calendar View</a></li>
                            <li><a class="dropdown-item" href="/deadlines"><i class="fas fa-clock me-2"></i>Deadlines</a></li>
                            <li><a class="dropdown-item" href="/tasks"><i class="fas fa-tasks me-2"></i>Tasks</a></li>
                        </ul>
                    </li>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown"><i class="fas fa-dollar-sign me-1"></i>Billing</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/billing"><i class="fas fa-chart-line me-2"></i>Dashboard</a></li>
                            <li><a class="dropdown-item" href="/billing/time"><i class="fas fa-stopwatch me-2"></i>Time Tracking</a></li>
                            <li><a class="dropdown-item" href="/billing/invoices"><i class="fas fa-file-invoice-dollar me-2"></i>Invoices</a></li>
                            <li><a class="dropdown-item" href="/billing/expenses"><i class="fas fa-receipt me-2"></i>Expenses</a></li>
                        </ul>
                    </li>
                    <li class="nav-item"><a class="nav-link" href="/"><i class="fas fa-file-alt me-1"></i>Documents</a></li>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown"><i class="fas fa-chart-bar me-1"></i>Reports</a>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/reports"><i class="fas fa-tachometer-alt me-2"></i>Dashboard</a></li>
                            <li><a class="dropdown-item" href="/reports/revenue"><i class="fas fa-dollar-sign me-2"></i>Revenue</a></li>
                            <li><a class="dropdown-item" href="/reports/productivity"><i class="fas fa-clock me-2"></i>Productivity</a></li>
                        </ul>
                    </li>
                </ul>
                <ul class="navbar-nav">
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown"><i class="fas fa-user-circle me-1"></i>Account</a>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="/team"><i class="fas fa-users-cog me-2"></i>Team</a></li>
                            <li><a class="dropdown-item" href="/activity"><i class="fas fa-history me-2"></i>Activity Log</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><form action="/logout" method="POST"><button type="submit" class="dropdown-item"><i class="fas fa-sign-out-alt me-2"></i>Logout</button></form></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    </nav>`;

// Files to update (practice management views)
const files = [
    'views/clients/detail.ejs',
    'views/clients/form.ejs',
    'views/cases/index.ejs',
    'views/cases/detail.ejs',
    'views/cases/form.ejs',
    'views/billing/dashboard.ejs',
    'views/billing/time.ejs',
    'views/billing/invoices.ejs',
    'views/billing/invoice-detail.ejs',
    'views/billing/expenses.ejs',
    'views/calendar/index.ejs',
    'views/calendar/deadlines.ejs',
    'views/calendar/tasks.ejs',
    'views/communications/messages.ejs',
    'views/communications/notifications.ejs',
    'views/collaboration/team.ejs',
    'views/collaboration/activity.ejs',
    'views/reports/dashboard.ejs',
    'views/reports/revenue.ejs',
    'views/reports/productivity.ejs',
    'views/reports/clients.ejs',
    'views/reports/cases.ejs'
];

// Pattern to match the simple nav (various forms)
const simpleNavPatterns = [
    /<nav class="navbar navbar-expand-lg navbar-dark pm-navbar">[\s\S]*?<div class="navbar-nav ms-auto">[\s\S]*?<\/nav>/,
    /<nav class="navbar navbar-expand-lg navbar-dark pm-navbar">[\s\S]*?<\/nav>/
];

let updated = 0;
let skipped = 0;

files.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipped (not found): ${file}`);
        skipped++;
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Check if already has the full nav (has collapse navbar-collapse)
    if (content.includes('collapse navbar-collapse')) {
        console.log(`Skipped (already updated): ${file}`);
        skipped++;
        return;
    }

    // Try to replace the simple nav
    let replaced = false;
    for (const pattern of simpleNavPatterns) {
        if (pattern.test(content)) {
            content = content.replace(pattern, fullNav);
            replaced = true;
            break;
        }
    }

    if (replaced) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated: ${file}`);
        updated++;
    } else {
        console.log(`Skipped (pattern not found): ${file}`);
        skipped++;
    }
});

console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);

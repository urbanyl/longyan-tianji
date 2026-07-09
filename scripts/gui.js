process.env.LOCAL_DASHBOARD_ENABLED = process.env.LOCAL_DASHBOARD_ENABLED || 'true';
process.env.LOCAL_DASHBOARD_OPEN = process.env.LOCAL_DASHBOARD_OPEN || 'true';

require('../index');

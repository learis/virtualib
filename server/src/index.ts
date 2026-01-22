import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path'; // Import path
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import bookRoutes from './routes/book.routes';
import libraryRoutes from './routes/library.routes';
import categoryRoutes from './routes/category.routes';
import loanRoutes from './routes/loan.routes';
import requestRoutes from './routes/request.routes';
import settingsRoutes from './routes/settings.routes';
import roleRoutes from './routes/role.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Changed port variable name and default value

app.use(helmet());
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/libraries', libraryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/roles', roleRoutes);
import dashboardRoutes from './routes/dashboard.routes';
app.use('/api/dashboard', dashboardRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Cron Jobs
import { initCronJobs } from './services/cron.service';
initCronJobs();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

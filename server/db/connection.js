const mongoose = require('mongoose');

// Correct MongoDB connection URL
const url = 'mongodb+srv://test:<test@123>@test-pro-db.v2qie.mongodb.net/?retryWrites=true&w=majority&appName=test-pro-db';

mongoose.connect(url, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to DB');
})
.catch((error) => {
    console.error('Error connecting to DB:', error);
});
cd
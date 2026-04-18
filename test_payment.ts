import axios from 'axios';

async function run() {
  try {
    const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'guest@example.com',
      password: 'password' // Assuming this is set up
    });
    const token = loginRes.data.token;
    console.log('Login success');

    // Get a spot ID
    const spotsRes = await axios.get('http://localhost:5001/api/spots');
    
    if (spotsRes.data.length === 0) {
        console.log('No spots found.');
        return;
    }
    const spotId = spotsRes.data[0].id;
    console.log('Spot ID:', spotId);

    // Initiate payment
    const payRes = await axios.post('http://localhost:5001/api/payments/initiate-upi', {
      spotId,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    }, { headers: { Authorization: `Bearer ${token}` }});
    console.log('Payment response:', payRes.data);
  } catch (error: any) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}
run();

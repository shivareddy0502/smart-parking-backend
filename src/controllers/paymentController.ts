import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
});
const prisma = new PrismaClient();

export const createOrder = async (req: Request, res: Response) => {
  try {
    const guestId = (req as any).user?.userId;
    if (!guestId) {
       return res.status(401).json({ error: 'Unauthorized' });
    }

    const { spotId, startTime, endTime } = req.body;
    
    // 1. Fetch spot to get rate
    const spot = await prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found' });
    }
    
    // 2. Calculate duration and total (Minimum 1 hour charge)
    const start = new Date(startTime);
    const end = new Date(endTime);
    const msDiff = end.getTime() - start.getTime();
    const hours = Math.max(1, Math.ceil(msDiff / 3600000));
    const totalAmount = (spot.rate * hours) + (spot.rate * hours * 0.1); // Add 10% platform fee
    const amountInPaise = Math.round(totalAmount * 100);

    // 3. Create Razorpay Order
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_order_${new Date().getTime()}`
    };

    const order = await razorpay.orders.create(options);

    // 4. Create PENDING booking in database linked to the razorpay order_id
    await prisma.booking.create({
      data: {
        spotId,
        guestId,
        startTime: start,
        endTime: end,
        totalAmount,
        status: 'PENDING',
        razorpayOrderId: order.id,
      }
    });

    res.json({ 
      id: order.id, 
      currency: order.currency, 
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder' 
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_mock_key';
  const signature = req.headers['x-razorpay-signature'] as string;

  try {
    const shasum = crypto.createHmac('sha256', secret);
    // Since req.body is parsed as raw in index.ts, it remains a Buffer
    shasum.update(req.body);
    const digest = shasum.digest('hex');

    if (digest === signature) {
      // Parse the raw body back to JSON for event handling
      const event = JSON.parse(req.body.toString());
      
      if (event.event === 'order.paid' || event.event === 'payment.captured') {
        const orderId = event.payload.payment.entity.order_id;
        
        console.log(`Payment successful for order ${orderId}! Marking Booking as CONFIRMED.`);
        
        // Update booking status from PENDING to CONFIRMED
        await prisma.booking.updateMany({
          where: { razorpayOrderId: orderId },
          data: { status: 'CONFIRMED' as any }
        });
      }
      return res.status(200).json({ status: 'ok' });
    } else {
      console.warn("Razorpay Webhook signature verification failed!");
      return res.status(400).send("Invalid signature");
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).send("Internal Server Error");
  }
};

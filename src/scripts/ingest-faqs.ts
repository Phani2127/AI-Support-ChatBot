
import "dotenv/config";
import { ingestFAQs } from "../services/faq-ingestion.service.js";

const faqs = [
  {
    question: "How can I reset my password?",
    answer:
      "Go to the login page, click Forgot Password, and follow the instructions sent to your registered email."
  },
  {
    question: "How can I contact customer support?",
    answer:
      "You can contact our support team through the contact form or by emailing support@example.com."
  },
  {
    question: "Can I get a refund?",
    answer:
      "Refunds are available within 30 days of purchase, provided the product meets our refund policy."
  },
  {
    question: "How do I update my email address?",
    answer:
      "Log in to your account, open Profile Settings, and update your email address."
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept credit cards, debit cards, and supported online payment methods."
  },
  {
    question: "How do I create an account?",
    answer:
      "Click Sign Up on the home page, enter your name, email, and a password, then confirm your email address using the link we send you."
  },
  {
    question: "How do I change my password?",
    answer:
      "Log in, open Account Settings, select Security, and choose Change Password. Enter your current password and your new one."
  },
  {
    question: "How do I delete my account?",
    answer:
      "Go to Account Settings, select Delete Account, and confirm. Deletion is permanent and removes your order history and saved data."
  },
  {
    question: "Why am I not receiving the verification email?",
    answer:
      "Check your spam or junk folder first. If it is not there, request a new verification email from the login page or contact support to confirm your email address."
  },
  {
    question: "How do I update my phone number?",
    answer:
      "Open Profile Settings, edit the phone number field, and click Save. You may be asked to verify the new number by SMS."
  },
  {
    question: "How do I enable two-factor authentication?",
    answer:
      "Go to Account Settings, open Security, and turn on Two-Factor Authentication. Follow the prompts to link an authenticator app or your phone number."
  },
  {
    question: "My account is locked. What should I do?",
    answer:
      "Accounts are locked temporarily after several failed login attempts. Wait 30 minutes and try again, or reset your password to unlock it immediately."
  },
  {
    question: "How do I track my order?",
    answer:
      "Open My Orders, select the order, and click Track Order. You can also use the tracking link in your shipping confirmation email."
  },
  {
    question: "How long does shipping take?",
    answer:
      "Standard shipping takes 5 to 7 business days. Express shipping takes 2 to 3 business days. Delivery times may vary by location."
  },
  {
    question: "How much does shipping cost?",
    answer:
      "Standard shipping costs a flat rate shown at checkout, and orders above the free shipping threshold ship free. Express shipping is charged at an additional fee."
  },
  {
    question: "Do you ship internationally?",
    answer:
      "Yes, we ship to many countries. Available destinations, delivery times, and shipping fees are shown at checkout once you enter your address."
  },
  {
    question: "Can I change my shipping address after placing an order?",
    answer:
      "You can change the address before the order is shipped. Contact support as soon as possible with your order number and the new address."
  },
  {
    question: "Can I cancel my order?",
    answer:
      "Orders can be cancelled before they are shipped. Go to My Orders, select the order, and click Cancel Order, or contact support for help."
  },
  {
    question: "Can I modify my order after placing it?",
    answer:
      "Changes such as size, color, or quantity are possible only before the order ships. Contact support immediately with your order number."
  },
  {
    question: "My order has not arrived. What should I do?",
    answer:
      "First check the tracking information for updates. If the delivery date has passed, contact support with your order number and we will investigate with the carrier."
  },
  {
    question: "I received a damaged item. What should I do?",
    answer:
      "We are sorry about that. Contact support within 7 days of delivery with your order number and photos of the damage, and we will arrange a replacement or refund."
  },
  {
    question: "I received the wrong item. What should I do?",
    answer:
      "Contact support with your order number and a photo of the item received. We will send the correct item and arrange a free return of the wrong one."
  },
  {
    question: "What is your return policy?",
    answer:
      "Items can be returned within 30 days of delivery if they are unused and in their original packaging. Some items, such as personalized products, are not returnable."
  },
  {
    question: "How do I return an item?",
    answer:
      "Go to My Orders, select the order, and click Return Item. Print the prepaid return label, pack the item securely, and drop it off with the carrier."
  },
  {
    question: "How long does a refund take?",
    answer:
      "Once we receive and inspect your return, refunds are issued within 5 to 7 business days. Your bank may take additional time to post the credit."
  },
  {
    question: "Will I get my shipping fee refunded?",
    answer:
      "Original shipping fees are refunded only if the return is due to our error, such as a damaged or incorrect item."
  },
  {
    question: "Can I exchange an item instead of returning it?",
    answer:
      "Yes. Start a return from My Orders and choose Exchange, then select the new size or color, subject to availability."
  },
  {
    question: "Which credit cards do you accept?",
    answer:
      "We accept Visa, Mastercard, American Express, and Discover credit cards."
  },
  {
    question: "Is it safe to enter my payment information?",
    answer:
      "Yes. All payments are encrypted and processed through secure payment providers. We do not store your full card details on our servers."
  },
  {
    question: "Why was my payment declined?",
    answer:
      "Payments can be declined due to incorrect card details, insufficient funds, or a bank security block. Check your details and try again, or contact your bank."
  },
  {
    question: "I was charged twice. What should I do?",
    answer:
      "A duplicate charge is often a temporary authorization hold that disappears within a few days. If it remains, contact support with your order number and we will resolve it."
  },
  {
    question: "Where can I find my invoice?",
    answer:
      "Open My Orders, select the order, and click Download Invoice. A copy is also sent to your email after purchase."
  },
  {
    question: "How do I apply a promo code?",
    answer:
      "Enter your promo code in the Promo Code field at checkout and click Apply. The discount will appear in your order summary."
  },
  {
    question: "Why is my promo code not working?",
    answer:
      "Promo codes may be expired, limited to certain products, or require a minimum order value. Check the terms of the code and make sure it is typed correctly."
  },
  {
    question: "Do you offer gift cards?",
    answer:
      "Yes. Digital gift cards are available in several amounts and are delivered by email. They can be redeemed at checkout."
  },
  {
    question: "How do I redeem a gift card?",
    answer:
      "Enter the gift card code in the Gift Card field at checkout, or add it to your account under Wallet. The balance is applied to your order."
  },
  {
    question: "Do you offer discounts for students or bulk orders?",
    answer:
      "We offer discounts for verified students and for bulk purchases. Contact support with details of your request for a quote."
  },
  {
    question: "What are your customer support hours?",
    answer:
      "Our support team is available Monday to Friday, 9 AM to 6 PM. Messages sent outside these hours are answered the next business day."
  },
  {
    question: "How quickly will support respond to my email?",
    answer:
      "We aim to reply to all emails within 24 hours on business days."
  },
  {
    question: "Is there a phone number for support?",
    answer:
      "Phone support is available during business hours. You can find the number on our Contact Us page, or email support@example.com."
  },
  {
    question: "How do I report a bug or technical problem?",
    answer:
      "Use the contact form and select Technical Issue. Include a description, the steps to reproduce it, and screenshots if possible."
  },
  {
    question: "Which browsers do you support?",
    answer:
      "Our website works best on the latest versions of Chrome, Firefox, Safari, and Edge."
  },
  {
    question: "Do you have a mobile app?",
    answer:
      "Yes. Our mobile app is available for iOS and Android. Search for our name in the App Store or Google Play."
  },
  {
    question: "How do I unsubscribe from marketing emails?",
    answer:
      "Click the Unsubscribe link at the bottom of any marketing email, or turn off email promotions under Account Settings, Notifications."
  },
  {
    question: "How do I manage my notification preferences?",
    answer:
      "Open Account Settings, select Notifications, and choose which emails, SMS, and push alerts you want to receive."
  },
  {
    question: "How is my personal data used?",
    answer:
      "We use your data only to process orders, provide support, and improve our services. We never sell your personal information. See our Privacy Policy for details."
  },
  {
    question: "Can I download a copy of my data?",
    answer:
      "Yes. Go to Account Settings, select Privacy, and click Request Data Export. We will email you a download link within a few days."
  },
  {
    question: "How do I cancel my subscription?",
    answer:
      "Open Account Settings, select Subscriptions, and click Cancel. You keep access until the end of the current billing period."
  },
  {
    question: "Will my subscription renew automatically?",
    answer:
      "Yes, subscriptions renew automatically at the end of each billing period. You can turn off auto-renewal in Subscriptions settings at any time."
  },
  {
    question: "How do I leave a product review?",
    answer:
      "Open My Orders, select the delivered item, and click Write a Review. Reviews appear on the product page after a short moderation check."
  }
];

async function main(): Promise<void> {
  await ingestFAQs(faqs);
  console.log("FAQ ingestion completed!");
}

main().catch((error: unknown) => {
  console.error("FAQ ingestion failed:", error);
  process.exitCode = 1;
});

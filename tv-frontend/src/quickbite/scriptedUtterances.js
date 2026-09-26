export const SCRIPTED = {
  '1': 'Find me the best biryani',
  '2': 'The second one',
  '3': 'दो बिरयानी कार्ट में add करो',
  '4': 'मुझे ग्रोसरी दिखाओ',
  '5': 'मेरा कार्ट दिखाओ',
  '6': 'Pay now with UPI',
  '7': 'मेरा ऑर्डर कहाँ है',
  '8': 'Show me something cheaper than 300',
  '9': 'Go back',
}

export function scriptedFor(digit) {
  return SCRIPTED[String(digit)] || ''
}

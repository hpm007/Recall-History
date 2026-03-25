const params = new URLSearchParams(window.location.search);
const userId = params.get("user_id");

if (!userId){
    document.body.innerHTML = "<p>Missing User Id</p>";
    throw new Error("Missing User Id");
}

Paddle.Environment.set("sandbox");
Paddle.Initialize({
token: "test_e56762c8c5827080c8e381a1e22",
eventCallback: handlePaddleEvent
});

setTimeout(() => Paddle.Checkout.open({
  items: [{priceId: "pri_01km62zpe537rz5wjgwv1kppch"}],
  customData: {
      user_id: userId
  }
  }), 1000);

console.log("Paddle loaded:", typeof Paddle);

function handlePaddleEvent(event) {
  console.log("Paddle event:", event);
  if (event.name === "checkout.completed") {
    onPaymentSuccess();
  }
}

async function onPaymentSuccess() {
  console.log("Payment successful!");
  await chrome.storage.local.remove("limit_state");

  document.getElementById("upgrade").style.display = "none";
  // show success banner
  const el = document.getElementById("Success!");
  el.style.display = "block";
  // Mark user as PRO locally (temporary optimism)
  await chrome.storage.local.set({
    user_plan: "pro"
  });
}
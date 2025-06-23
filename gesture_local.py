import cv2
import mediapipe as mp
import pyautogui
import time

# Initialize webcam
cap = cv2.VideoCapture(0)

# Mediapipe hands model
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.7, min_tracking_confidence=0.6)
mp_draw = mp.solutions.drawing_utils

# State variables
last_gesture = ""
last_action_time = 0
toggle_time = 0
cooldown = 1.5  # seconds
gesture_control_enabled = False
just_toggled = False  # <-- New flag

def detect_hand_side(landmarks):
    x_coords = [lm.x for lm in landmarks.landmark]
    avg_x = sum(x_coords) / len(x_coords)
    return "Left" if avg_x < 0.5 else "Right"

def get_gesture(landmarks):
    fingers = []
    for i in [8, 12, 16, 20]:
        tip_y = landmarks.landmark[i].y
        pip_y = landmarks.landmark[i - 2].y
        fingers.append(tip_y < pip_y)
    if all(not f for f in fingers):
        return "Fist"
    return "Open"

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hands.process(rgb)

    gesture = ""
    current_time = time.time()
    h, w, _ = frame.shape
    num_hands = 0

    if result.multi_hand_landmarks:
        num_hands = len(result.multi_hand_landmarks)

        # Toggle gesture control if both hands are visible
        if num_hands == 2 and (current_time - toggle_time) > 2:
            gesture_control_enabled = not gesture_control_enabled
            toggle_time = current_time
            just_toggled = True  # set flag to skip gesture processing
            print(f"🌀 Gesture Control Toggled: {'ON' if gesture_control_enabled else 'OFF'}")

        if gesture_control_enabled and not just_toggled:
            for hand_landmarks in result.multi_hand_landmarks:
                mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                hand_side = detect_hand_side(hand_landmarks)
                hand_pose = get_gesture(hand_landmarks)

                if hand_pose == "Fist":
                    gesture = "Fist"
                elif hand_side == "Right" and hand_pose == "Open":
                    gesture = "Volume Up"
                elif hand_side == "Left" and hand_pose == "Open":
                    gesture = "Volume Down"

                if gesture and (current_time - last_action_time) > cooldown:
                    if gesture == "Fist":
                        pyautogui.press("playpause")
                        print("▶️ Play/Pause")
                    elif gesture == "Volume Up":
                        for _ in range(3):
                            pyautogui.press("volumeup")
                        print("🔊 Volume Up x3")
                    elif gesture == "Volume Down":
                        for _ in range(3):
                            pyautogui.press("volumedown")
                        print("🔉 Volume Down x3")

                    last_action_time = current_time
                    last_gesture = gesture

                cv2.putText(frame, f"{gesture}", (20, 60), cv2.FONT_HERSHEY_SIMPLEX,
                            1.5, (0, 255, 0), 3)

    # Reset toggle-skip flag after one frame
    if just_toggled:
        just_toggled = False

    # Show gesture control state
    state_text = f"Gesture Control: {'ON' if gesture_control_enabled else 'OFF'}"
    cv2.putText(frame, state_text, (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX,
                0.9, (0, 255, 255) if gesture_control_enabled else (0, 0, 255), 2)

    cv2.imshow("🖐 Gesture Media Controller", frame)
    if cv2.waitKey(1) & 0xFF == 27:  # ESC key
        break

cap.release()
cv2.destroyAllWindows()

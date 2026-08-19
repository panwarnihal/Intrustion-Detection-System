import tkinter as tk
import sys

def main():
    root = tk.Tk()
    root.title("Security Blackout")
    
    # Configure fullscreen, always on top, and hide the cursor
    root.attributes("-fullscreen", True)
    root.attributes("-topmost", True)
    root.config(cursor="none", bg="black")
    
    # Block standard close button (window decorations are hidden in fullscreen anyway)
    def disable_event():
        pass
    root.protocol("WM_DELETE_WINDOW", disable_event)
    
    # Prevent keyboard bypasses
    root.bind("<Escape>", lambda e: "break")
    root.bind("<Alt-F4>", lambda e: "break")
    
    # Center frame for contents
    frame = tk.Frame(root, bg="black")
    frame.place(relx=0.5, rely=0.5, anchor="center")
    
    warning_title = tk.Label(
        frame, 
        text="⚠️ SECURITY BLOCK ⚠️", 
        font=("Consolas", 42, "bold"), 
        fg="#ff3333", 
        bg="black"
    )
    warning_title.pack(pady=20)
    
    warning_msg = tk.Label(
        frame, 
        text="UNAUTHORIZED RECORDING THREAT DETECTED!\nTHE SCREEN HAS BEEN TEMPORARILY BLACKED OUT TO PREVENT EXFILTRATION.", 
        font=("Consolas", 20, "bold"), 
        fg="white", 
        bg="black",
        justify="center"
    )
    warning_msg.pack(pady=10)
    
    instruction = tk.Label(
        frame, 
        text="Remove cell phones, cameras, or external capture devices to restore screen access.", 
        font=("Consolas", 14), 
        fg="#777777", 
        bg="black"
    )
    instruction.pack(pady=30)
    
    root.mainloop()

if __name__ == "__main__":
    main()

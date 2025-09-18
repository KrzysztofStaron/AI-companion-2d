import cv2
import numpy as np
from PIL import Image
import os
import argparse

def remove_background_reliable(image_path, method="bucket", x=0, y=0, tolerance=30, output_suffix="_transparent"):
    """
    Reliable background removal using multiple methods
    
    Args:
        image_path: Path to the input image
        method: "bucket", "edges", or "threshold" (thresholding + contours)
        x, y: Position for bucket tool (default 0,0)
        tolerance: Color tolerance for flood fill
        output_suffix: Suffix for output filename
    """
    
    # Load image
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    
    if img is None:
        print(f"Error: Could not load image from {image_path}")
        return None
    
    print(f"Original image shape: {img.shape}")
    
    # Convert to RGBA if not already
    if len(img.shape) == 3 and img.shape[2] == 3:
        # Add alpha channel
        alpha_channel = np.ones((img.shape[0], img.shape[1], 1), dtype=img.dtype) * 255
        img = np.concatenate([img, alpha_channel], axis=2)
    
    if method == "bucket":
        return _bucket_tool_method(img, x, y, tolerance, image_path, output_suffix)
    elif method == "edges":
        return _edge_detection_method(img, image_path, output_suffix)
    elif method == "threshold":
        return _threshold_contour_method(img, image_path, output_suffix)
    else:
        print(f"Unknown method: {method}")
        return None

def _bucket_tool_method(img, x, y, tolerance, image_path, output_suffix):
    """Bucket tool method using flood fill"""
    
    # Get the color at the specified position
    target_color = img[y, x]
    print(f"Target color at position ({x}, {y}): {target_color}")
    
    # Create a 3-channel version for flood fill
    img_3ch = img[:, :, :3].copy()
    
    # Create mask for flood fill
    h, w = img.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    
    # Define the new color (black for now, we'll set alpha separately)
    new_color = (0, 0, 0)
    
    # Apply flood fill on 3-channel image
    cv2.floodFill(img_3ch, mask, (x, y), new_color, 
                  (tolerance, tolerance, tolerance), 
                  (tolerance, tolerance, tolerance))
    
    # Create a mask of the filled area
    filled_mask = mask[1:h+1, 1:w+1]  # Remove padding
    
    # Set alpha channel to 0 (transparent) where the mask is filled
    img[:, :, 3] = np.where(filled_mask > 0, 0, img[:, :, 3])
    
    # Save the result
    output_path = image_path.replace('.png', f'{output_suffix}.png')
    cv2.imwrite(output_path, img)
    
    print(f"Bucket tool applied. Modified image saved as: {output_path}")
    return output_path

def _edge_detection_method(img, image_path, output_suffix):
    """Edge detection method for background removal"""
    
    # Convert to grayscale for edge detection
    gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    
    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Edge detection using Canny
    edges = cv2.Canny(blurred, 50, 150)
    
    # Morphological operations to close gaps
    kernel = np.ones((3, 3), np.uint8)
    edges_closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    
    # Find contours
    contours, _ = cv2.findContours(edges_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Create mask
    mask = np.zeros(gray.shape, dtype=np.uint8)
    
    # Fill the largest contour (assuming it's the main subject)
    if contours:
        largest_contour = max(contours, key=cv2.contourArea)
        cv2.fillPoly(mask, [largest_contour], 255)
        
        # Apply the mask to alpha channel
        img[:, :, 3] = mask
    
    # Save the result
    output_path = image_path.replace('.png', f'{output_suffix}_edges.png')
    cv2.imwrite(output_path, img)
    
    print(f"Edge detection applied. Modified image saved as: {output_path}")
    return output_path

def _threshold_contour_method(img, image_path, output_suffix):
    """Thresholding + contour method (based on Stack Overflow solution)"""
    
    # Convert to grayscale for thresholding
    gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    
    # (1) Convert to gray, and threshold
    th, threshed = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
    
    # (2) Morph-op to remove noise
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    morphed = cv2.morphologyEx(threshed, cv2.MORPH_CLOSE, kernel)
    
    # (3) Find the max-area contour
    contours, _ = cv2.findContours(morphed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("No contours found!")
        return None
    
    # Get the largest contour
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Create a mask from the contour
    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.fillPoly(mask, [largest_contour], 255)
    
    # Apply the mask to alpha channel
    img[:, :, 3] = mask
    
    # Save the result
    output_path = image_path.replace('.png', f'{output_suffix}_threshold.png')
    cv2.imwrite(output_path, img)
    
    print(f"Threshold + contour method applied. Modified image saved as: {output_path}")
    return output_path

def batch_remove_background(input_dir=".", pattern="*.png", method="bucket"):
    """Remove background from all images matching pattern"""
    
    import glob
    
    image_files = glob.glob(os.path.join(input_dir, pattern))
    
    if not image_files:
        print(f"No images found matching pattern: {pattern}")
        return
    
    print(f"Found {len(image_files)} images to process")
    
    for image_path in image_files:
        print(f"\nProcessing: {image_path}")
        remove_background_reliable(image_path, method=method)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reliable background removal tool")
    parser.add_argument("image", nargs="?", default="test.png", help="Image file to process")
    parser.add_argument("--method", choices=["bucket", "edges", "threshold"], default="bucket", help="Background removal method")
    parser.add_argument("--x", type=int, default=0, help="X coordinate for bucket tool")
    parser.add_argument("--y", type=int, default=0, help="Y coordinate for bucket tool")
    parser.add_argument("--tolerance", type=int, default=30, help="Color tolerance for bucket tool")
    parser.add_argument("--batch", action="store_true", help="Process all PNG files in current directory")
    
    args = parser.parse_args()
    
    if args.batch:
        print("Processing all PNG files in batch mode...")
        batch_remove_background(method=args.method)
    else:
        image_path = args.image
        
        if os.path.exists(image_path):
            print(f"Processing: {image_path}")
            result = remove_background_reliable(
                image_path, 
                method=args.method, 
                x=args.x, 
                y=args.y, 
                tolerance=args.tolerance
            )
            if result:
                print("Background removal completed successfully!")
        else:
            print(f"Error: {image_path} not found in current directory")

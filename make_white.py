@'
from PIL import Image
import numpy as np

img = Image.open('src/assets/wasel-logo-source.png').convert('RGBA')
arr = np.array(img)
new_arr = arr.copy()
mask = arr[:,:,3] > 0
new_arr[mask, 0] = 255
new_arr[mask, 1] = 255
new_arr[mask, 2] = 255
new_img = Image.fromarray(new_arr)
new_img.save('src/assets/wasel-logo-white.png')
print('done')
'@

###Linux Installation
OpenCL drivers for Nvidia or AMD cards is required. How to install::
```
sudo add-apt-repository ppa:graphics-drivers

NVIDIA:
nvidia-compute-utils-[latest] //430 as of writing
nvidia-utils-[latest] //430 as of writing
nvidia-cuda-toolkit

AMD
//download the drivers (.run file) from AMD.
amdgpu-pro-install --opencl=pal,legacy --headless //--opencl=rocm for >vega cards
Note: amdgpu-pro-19.20 is the latest supported build for Vega/VII cards. The introduction of amdgpu-19.30 (5700XT release) has been shaky. I cannot get a 5700XT to work in 19.30, and it also doesnt like my Vegas or VII, so 19.20 it is for now. Apparently the next major release improves Navi card support. 5700XT on windows works in the meantime...
```

Install node.js 10.x and deps
```
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install node-gyp
sudo apt install libunbound-dev
sudo apt install alsa-utils
```

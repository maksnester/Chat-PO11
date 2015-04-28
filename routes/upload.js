var fs = require('fs');

exports.post = function (req, res, next) {
    var userId = req.session.user;
    console.warn(req.files);
    var file = req.files.file;
    if (file) {
        var tmp_path = file.path;
        var target_path = 'public/uploads/' + userId;
        console.info("tmp_path", tmp_path);
        console.info("target_path", target_path);

        try {
            var stat = fs.statSync(target_path);
        } catch (err) {
            fs.mkdirSync(target_path);
        }

        target_path += "/" + file.name;
        // на этом этапе появится папка /uploads/userid
        console.info("target_path", target_path);


        fs.rename(tmp_path, target_path, function(err) {
            if (err) {
                throw err;
            }
            fs.unlink(tmp_path, function() {
                if (err) {
                    throw err;
                }
                res.send('File uploaded to: ' + target_path + ' - ' + file.size + ' bytes');
            });
        });
    }
    else {
        console.log('file is not correctly');
        res.redirect('/account');
    }
};

exports.get = function (req, res, next) {
    console.error("WHY GET!!!!!????");
};
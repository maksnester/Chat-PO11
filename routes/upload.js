var fs = require('fs');

exports.post = function (req, res, next) {
    var userId = req.session.user;
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
                return next(err);
            }
            fs.unlink(tmp_path, function() {
                if (err) {
                    return next(err);
                }
                console.info('File uploaded to: ' + target_path + ' - ' + file.size + ' bytes');
                res.redirect('/account');
            });
        });
    }
    else {
        console.log('file is not correctly');
        res.redirect('/account');
    }
};

/**
 * Отправляет в ответ на этот запрос JSON со списком файлов пользователя.
 * @param req
 * @param res
 * @param next
 */
exports.getUserFiles = function (req, res, next) {
    var userId = req.session.user;
    var path = 'public/uploads/' + userId + '/';
    var fileLink = path.replace('public/', '');
    fs.stat(path, function(err, stats) {
        if (stats && stats.isDirectory()) {
            fs.readdir(path, function(err, files) {
                if (err) return next(err);
                if (!files) return res.send([]);

                var listOfFiles = {}; // {filename: filePath}
                files.forEach(function(file) {
                    listOfFiles[file] = fileLink + file; // ссылка на файл
                });

                res.send([listOfFiles]);
            });
        } else {
            res.send([]);
        }
    });
};